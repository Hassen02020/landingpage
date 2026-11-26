import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0031 sur PostgreSQL (PGlite) : décision Q8-A (26/11/2026) — un employé ne lit que ses leads actuellement affectés (accès par jeton),
// jamais ceux d'un collègue, des non affectés ni d'une autre entreprise ; admin et manager gardent leur organisation entière. Rôles et jetons réels (SET ROLE authenticated + auth.uid()).
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql"].map(M).join("\n")
const M8 = M("0008_multitenant_foundation.sql")
const M9 = M("0009_employees_see_org_leads.sql")
const M31 = M("0031_employee_own_leads_only.sql")
const ROLLBACK31 = read("rollback/0031_rollback.sql")
const POST31 = read("scripts/postcheck-0031.sql")
const STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now(), banned_until timestamptz, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`

const ALICE = "00000000-0000-4000-8000-0000000000a0"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const U = (n: string) => `00000000-0000-4000-8000-0000000000${n}`
const [A_ADMIN, A_MGR, A_EMP1, A_EMP2, B_EMP, OUTSIDER] = [U("11"), U("12"), U("13"), U("14"), U("21"), U("31")]

let db: PGlite
let n = 0
async function lead(org: string, assigned: string | null = null) {
  n++
  const row = { ref: `E2B-ZZ${String(n).padStart(4, "2")}`, idempotency_key: `evt-${String(n).padStart(8, "0")}`, first_name: "Test", phone: `2169900${String(n).padStart(4, "0")}`, product: "omra", contact_consent: true, organization_id: org, assigned_to: assigned }
  const k = Object.keys(row)
  const id = (await db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))).rows[0].id
  await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ($1, 'api', 'note')", [id])
  return id
}
async function asUser<T = any>(sub: string | null, sql: string): Promise<T[]> {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub ?? ""}', false); SET ROLE authenticated`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec("RESET ROLE")
  }
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort()

let aEmp1Lead: string, aEmp2Lead: string, aFree: string, bLead: string

async function seed() {
  await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${ALICE}', 'alice', 'Alice SARL'), ('${BOB}', 'bob', 'Bob SARL')`)
  for (const [id, e] of [[A_ADMIN, "aa"], [A_MGR, "am"], [A_EMP1, "e1"], [A_EMP2, "e2"], [B_EMP, "be"], [OUTSIDER, "x"]]) await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${e}@x.tn')`)
  await db.exec(`
    INSERT INTO landing_staff (user_id, email, role, organization_id) VALUES
      ('${A_EMP1}', 'e1@x.tn', 'agent', '${ALICE}'), ('${A_EMP2}', 'e2@x.tn', 'agent', '${ALICE}'), ('${B_EMP}', 'be@x.tn', 'agent', '${BOB}');
    INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${ALICE}', '${A_ADMIN}', 'admin'), ('${ALICE}', '${A_MGR}', 'manager'), ('${BOB}', '${U("22")}', 'admin');`).catch(() => {})
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${U("22")}', 'bobadmin@x.tn') ON CONFLICT DO NOTHING`).catch(() => {})
  aEmp1Lead = await lead(ALICE, A_EMP1)
  aEmp2Lead = await lead(ALICE, A_EMP2)
  aFree = await lead(ALICE, null)
  bLead = await lead(BOB, B_EMP)
}

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(BEFORE)
  await db.exec(M8)
  // l'administrateur de Bob doit exister avant l'insertion des membres
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${U("22")}', 'bobadmin@x.tn')`)
  await seed()
})


// deux états de départ possibles en production : 0008 seule (employé = ses leads + non affectés) ou 0008 + 0009 (employé = toute l'organisation)
const STATES: [string, () => Promise<void>][] = [
  ["0008 seule", async () => { await db.exec(M31) }],
  ["0008 + 0009", async () => { await db.exec(M9); await db.exec(M31) }],
]

describe("migration 0031 : garde-fous", () => {
  it("exige 0008, refuse une base EasyV4, est rejouable sans effet", async () => {
    const early = new PGlite()
    await early.exec(STUB + BEFORE)
    await expect(early.exec(M31)).rejects.toThrow(/0008/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + M8 + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M31)).rejects.toThrow(/EasyV4/)
    await db.exec(M31)
    await db.exec(M31)
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead])
  })
})

for (const [label, apply] of STATES) {
  describe(`APRÈS 0031 (départ : ${label}) : un employé ne lit que ses leads affectés`, () => {
    it("employé A1 ne lit pas les dossiers de A2 ni les non affectés ; employé A2 ne lit pas ceux de A1 (accès direct par identifiant compris)", async () => {
      await apply()
      expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead])
      expect(ids(await asUser(A_EMP2, "SELECT id FROM landing_leads"))).toEqual([aEmp2Lead])
      expect(await asUser(A_EMP1, `SELECT id FROM landing_leads WHERE id IN ('${aEmp2Lead}', '${aFree}')`)).toEqual([])
      expect(await asUser(A_EMP2, `SELECT id FROM landing_leads WHERE id = '${aEmp1Lead}'`)).toEqual([])
    })
    it("un employé ne lit aucun dossier d'une autre organisation, dans les deux sens ; il garde l'accès à ses dossiers affectés", async () => {
      await apply()
      expect(await asUser(A_EMP1, `SELECT id FROM landing_leads WHERE id = '${bLead}'`)).toEqual([])
      expect(ids(await asUser(B_EMP, "SELECT id FROM landing_leads"))).toEqual([bLead])
      expect(await asUser(B_EMP, `SELECT id FROM landing_leads WHERE id IN ('${aEmp1Lead}', '${aEmp2Lead}', '${aFree}')`)).toEqual([])
      expect((await asUser(A_EMP1, `SELECT id FROM landing_leads WHERE id = '${aEmp1Lead}'`)).length).toBe(1)
    })
    it("l'historique suit le lead : un employé ne lit que l'historique de ses dossiers", async () => {
      await apply()
      expect((await asUser<{ lead_id: string }>(A_EMP1, "SELECT lead_id FROM landing_lead_activities")).map((r) => r.lead_id)).toEqual([aEmp1Lead])
      expect(await asUser(A_EMP1, `SELECT 1 FROM landing_lead_activities WHERE lead_id IN ('${aEmp2Lead}', '${aFree}', '${bLead}')`)).toEqual([])
    })
    it("admin et manager conservent toute leur organisation (jamais l'autre) ; sans organisation, désactivé, suspendu ou anonyme : rien", async () => {
      await apply()
      const all = [aEmp1Lead, aEmp2Lead, aFree].sort()
      expect(ids(await asUser(A_ADMIN, "SELECT id FROM landing_leads"))).toEqual(all)
      expect(ids(await asUser(A_MGR, "SELECT id FROM landing_leads"))).toEqual(all)
      expect((await asUser(A_ADMIN, "SELECT 1 FROM landing_lead_activities")).length).toBe(3)
      expect((await asUser(A_MGR, "SELECT 1 FROM landing_lead_activities")).length).toBe(3)
      expect(await asUser(A_MGR, `SELECT id FROM landing_leads WHERE id = '${bLead}'`)).toEqual([])
      expect(await asUser(OUTSIDER, "SELECT 1 FROM landing_leads")).toEqual([])
      expect(await asUser(null, "SELECT 1 FROM landing_leads")).toEqual([])
      await db.exec(`UPDATE organization_members SET active = false WHERE user_id = '${A_EMP1}'`)
      expect(await asUser(A_EMP1, "SELECT 1 FROM landing_leads")).toEqual([])
      await db.exec(`UPDATE organizations SET status = 'suspended' WHERE id = '${ALICE}'`)
      expect(await asUser(A_MGR, "SELECT 1 FROM landing_leads")).toEqual([])
      expect(ids(await asUser(B_EMP, "SELECT id FROM landing_leads"))).toEqual([bLead])
    })
    it("réaffectation : le dossier sort de la lecture de l'ancien employé et entre dans celle du nouveau ; l'historique reste en base", async () => {
      await apply()
      const acts = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_lead_activities WHERE lead_id = $1", [aEmp1Lead])).rows[0].n
      await db.exec(`UPDATE landing_leads SET assigned_to = '${A_EMP2}' WHERE id = '${aEmp1Lead}'`) // fait par le serveur (propriétaire / clé de service)
      expect(await asUser(A_EMP1, "SELECT 1 FROM landing_leads")).toEqual([])
      expect(await asUser(A_EMP1, "SELECT 1 FROM landing_lead_activities")).toEqual([])
      expect(ids(await asUser(A_EMP2, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aEmp2Lead].sort())
      expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_lead_activities WHERE lead_id = $1", [aEmp1Lead])).rows[0].n).toBe(acts)
    })
    it("les routes serveur (clé de service, qui ignore la RLS) lisent toujours toute l'organisation : détection des doublons préservée", async () => {
      await apply()
      await db.exec(`UPDATE landing_leads SET phone = '21611111111', product = CASE WHEN id = '${aEmp1Lead}' THEN 'omra' ELSE 'voyage' END WHERE id IN ('${aEmp1Lead}', '${aEmp2Lead}')`)
      await db.exec("SET ROLE service_role")
      try {
        const dup = (await db.query<{ id: string }>(`SELECT id FROM landing_leads WHERE phone = '21611111111' AND organization_id = '${ALICE}'`)).rows
        expect(ids(dup)).toEqual([aEmp1Lead, aEmp2Lead].sort())
        expect((await db.query("SELECT 1 FROM landing_leads WHERE organization_id = $1", [ALICE])).rows.length).toBe(3)
      } finally {
        await db.exec("RESET ROLE")
      }
      // l'employé, lui, ne voit pas le doublon d'un collègue par le jeton
      expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads WHERE phone = '21611111111'"))).toEqual([aEmp1Lead])
    })
    it("l'employé reste en LECTURE SEULE et ne voit toujours pas les événements de navigation", async () => {
      await apply()
      await db.exec(`INSERT INTO landing_events (event_name, event_id, product, organization_id) VALUES ('Contact', 'ev-a0000001', 'omra', '${ALICE}')`)
      await expect(asUser(A_EMP1, `UPDATE landing_leads SET assigned_to = '${A_EMP1}' WHERE id = '${aEmp2Lead}'`)).rejects.toThrow(/permission denied/)
      expect(await asUser(A_EMP1, "SELECT 1 FROM landing_events")).toEqual([])
      expect((await asUser(A_ADMIN, "SELECT 1 FROM landing_events")).length).toBe(1)
    })
  })
}

describe("AVANT 0031 : l'état connu que la migration corrige", () => {
  it("avec 0008 + 0009, un employé lit TOUTE son organisation (la limite identifiée)", async () => {
    await db.exec(M9)
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aEmp2Lead, aFree].sort())
  })
})

describe("retour arrière 0031 et contrôle", () => {
  it("le retour arrière remet la règle de 0008 sans toucher aucune donnée", async () => {
    await db.exec(M31)
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n
    await db.exec(ROLLBACK31)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n).toBe(before)
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aFree].sort())
    await db.exec(M31) // rejouable
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead])
  })
  it("postcheck-0031 : 6 contrôles OK après 0031 (départ 0008 ou 0009) ; en ÉCHEC avant ; lecture seule", async () => {
    const run = async () => ((await db.exec(POST31)) as unknown as { rows: { statut: string }[] }[])[0].rows.map((r) => r.statut)
    expect((await run()).includes("ÉCHEC")).toBe(true)
    await db.exec(M31)
    expect(await run()).toEqual(Array(6).fill("OK"))
    await db.exec(M9)
    expect((await run()).includes("ÉCHEC")).toBe(true) // 0009 rejouée par-dessus : le contrôle le détecte
    expect(POST31.replace(/--.*$/gm, "")).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s|GRANT\s|TRUNCATE)\b/i)
  })
})
