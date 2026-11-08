import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0009 sur PostgreSQL (PGlite) : RÈGLE DU PROPRIÉTAIRE (08/11/2026) — tous les employés voient tous les leads de LEUR entreprise,
// aucun employé ne voit les leads d'une autre entreprise. Rôles et jetons réels (SET ROLE authenticated + auth.uid()).
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql"].map(M).join("\n")
const M8 = M("0008_multitenant_foundation.sql")
const M9 = M("0009_employees_see_org_leads.sql")
const ROLLBACK9 = read("rollback/0009_rollback.sql")
const POST9 = read("scripts/postcheck-0009.sql")
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

describe("migration 0009 : garde-fous", () => {
  it("exige 0008, refuse une seconde exécution et une base EasyV4", async () => {
    const early = new PGlite()
    await early.exec(STUB + BEFORE)
    await expect(early.exec(M9)).rejects.toThrow(/0008/)
    await db.exec(M9)
    await expect(db.exec(M9)).rejects.toThrow(/déjà/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + M8 + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M9)).rejects.toThrow(/EasyV4/)
  })
})

describe("RÈGLE : tous les employés voient TOUS les leads de leur entreprise — jamais ceux d'une autre", () => {
  it("AVANT 0009 (état de la production, 0008 seule) : un employé voit moins que son entreprise — c'est ce que 0009 corrige", async () => {
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aFree].sort()) // pas le lead de son collègue
  })

  it("APRÈS 0009 : chaque employé de A voit les 3 leads de A (les siens, ceux d'un collègue, les non affectés) et AUCUN lead de B", async () => {
    await db.exec(M9)
    const all = [aEmp1Lead, aEmp2Lead, aFree].sort()
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual(all)
    expect(ids(await asUser(A_EMP2, "SELECT id FROM landing_leads"))).toEqual(all)
    expect(await asUser(A_EMP1, `SELECT id FROM landing_leads WHERE id = '${bLead}'`)).toEqual([]) // accès direct à un lead de B
    const orgs = await asUser<{ organization_id: string }>(A_EMP2, "SELECT DISTINCT organization_id FROM landing_leads")
    expect(orgs).toEqual([{ organization_id: ALICE }])
  })

  it("symétrique : l'employé de B ne voit que les leads de B, jamais ceux de A", async () => {
    await db.exec(M9)
    expect(ids(await asUser(B_EMP, "SELECT id FROM landing_leads"))).toEqual([bLead])
    expect(await asUser(B_EMP, `SELECT id FROM landing_leads WHERE id IN ('${aEmp1Lead}', '${aEmp2Lead}', '${aFree}')`)).toEqual([])
  })

  it("l'historique suit la même règle (employé : tout l'historique de son entreprise, rien d'une autre)", async () => {
    await db.exec(M9)
    const rows = await asUser<{ lead_id: string }>(A_EMP1, "SELECT lead_id FROM landing_lead_activities")
    expect(rows.map((r) => r.lead_id).sort()).toEqual([aEmp1Lead, aEmp2Lead, aFree].sort())
    expect(await asUser(A_EMP1, `SELECT 1 FROM landing_lead_activities WHERE lead_id = '${bLead}'`)).toEqual([])
  })

  it("admin et manager inchangés (toute leur organisation, jamais l'autre) ; sans organisation, désactivé ou anonyme : rien", async () => {
    await db.exec(M9)
    const all = [aEmp1Lead, aEmp2Lead, aFree].sort()
    expect(ids(await asUser(A_ADMIN, "SELECT id FROM landing_leads"))).toEqual(all)
    expect(ids(await asUser(A_MGR, "SELECT id FROM landing_leads"))).toEqual(all)
    expect(await asUser(OUTSIDER, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(await asUser(null, "SELECT 1 FROM landing_leads")).toEqual([])
    await db.exec(`UPDATE organization_members SET active = false WHERE user_id = '${A_EMP1}'`)
    expect(await asUser(A_EMP1, "SELECT 1 FROM landing_leads")).toEqual([])
    await db.exec("RESET ROLE")
    await db.exec("SET ROLE anon")
    await expect(db.query("SELECT 1 FROM landing_leads")).rejects.toThrow(/permission denied/)
    await db.exec("RESET ROLE")
  })

  it("une organisation suspendue : ses employés ne voient plus rien, les autres ne sont pas touchés", async () => {
    await db.exec(M9)
    await db.exec(`UPDATE organizations SET status = 'suspended' WHERE id = '${ALICE}'`)
    expect(await asUser(A_EMP1, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(ids(await asUser(B_EMP, "SELECT id FROM landing_leads"))).toEqual([bLead])
  })

  it("l'employé reste en LECTURE SEULE (aucune modification par l'API) et ne voit toujours pas les événements de navigation", async () => {
    await db.exec(M9)
    await db.exec(`INSERT INTO landing_events (event_name, event_id, product, organization_id) VALUES ('Contact', 'ev-a0000001', 'omra', '${ALICE}')`)
    await expect(asUser(A_EMP1, `UPDATE landing_leads SET status = 'perdu' WHERE id = '${aFree}'`)).rejects.toThrow(/permission denied/)
    await expect(asUser(A_EMP1, `UPDATE landing_leads SET assigned_to = '${A_EMP1}' WHERE id = '${aEmp2Lead}'`)).rejects.toThrow(/permission denied/)
    expect(await asUser(A_EMP1, "SELECT 1 FROM landing_events")).toEqual([])
    expect((await asUser(A_ADMIN, "SELECT 1 FROM landing_events")).length).toBe(1)
  })
})

describe("retour arrière 0009 et contrôle", () => {
  it("le retour arrière remet la règle de 0008 sans toucher aucune donnée ; refusé si 0009 n'est pas appliquée", async () => {
    await expect(db.exec(ROLLBACK9)).rejects.toThrow(/0009 n'est pas appliquée/)
    await db.exec("ROLLBACK") // le script s'exécute dans une transaction : après le refus attendu, on la referme
    await db.exec(M9)
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n
    await db.exec(ROLLBACK9)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n).toBe(before)
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aFree].sort())
    await db.exec(M9) // rejouable
    expect(ids(await asUser(A_EMP1, "SELECT id FROM landing_leads"))).toEqual([aEmp1Lead, aEmp2Lead, aFree].sort())
  })

  it("postcheck-0009 : 5 contrôles OK après 0009 ; en ÉCHEC dès que la règle n'est pas appliquée (0008 seule) ; lecture seule", async () => {
    const run = async () => ((await db.exec(POST9)) as unknown as { rows: { statut: string }[] }[])[0].rows.map((r) => r.statut)
    expect((await run()).includes("ÉCHEC")).toBe(true) // 0008 seule : les 2 premiers contrôles échouent
    await db.exec(M9)
    expect(await run()).toEqual(Array(5).fill("OK"))
    expect(POST9.replace(/--.*$/gm, "")).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s|GRANT\s|TRUNCATE)\b/i)
  })
})
