import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0012 sur PostgreSQL (PGlite) : création d'une entreprise + de son premier administrateur par le Super Admin.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql"].map(M).join("\n")
const M11 = M("0011_per_org_uniqueness_contract.sql")
const M12 = M("0012_platform_organizations.sql")
const R12 = read("rollback/0012_rollback.sql")
const POST12 = read("scripts/postcheck-0012.sql")
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

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const SUPER = "aaaaaaaa-0000-4000-8000-000000000001"
const STRANGER = "aaaaaaaa-0000-4000-8000-000000000002"
const BOB_ADMIN = "bbbbbbbb-0000-4000-8000-000000000001"
const CAROL_ADMIN = "bbbbbbbb-0000-4000-8000-000000000002"
let db: PGlite
const exec = (sql: string) => db.exec(sql)
const call = (actor: string, admin: string, slug = "bob", email = "Bob@Bob.tn") =>
  db.query<{ id: string }>("SELECT public.landing_create_organization($1,$2,$3,$4,$5,$6,$7) AS id", ["Bob SARL", slug, "voyage", actor, admin, email, "Bob Directeur"])
const asService = async <T>(fn: () => Promise<T>) => { await exec("SET ROLE service_role"); try { return await fn() } finally { await exec("RESET ROLE") } }

beforeEach(async () => {
  db = new PGlite()
  await exec(STUB)
  await exec(BEFORE)
  await exec(M12)
  await exec(`INSERT INTO auth.users (id, email) VALUES ('${SUPER}','super@x.tn'),('${STRANGER}','stranger@x.tn'),('${BOB_ADMIN}','bob@bob.tn'),('${CAROL_ADMIN}','carol@carol.tn');
              INSERT INTO platform_admins (user_id) VALUES ('${SUPER}');`)
})

describe("0012 : garde-fous", () => {
  it("exige 0008, refuse une seconde exécution et une base EasyV4", async () => {
    await expect(exec(M12)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M12)).rejects.toThrow(/0008/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M12)).rejects.toThrow(/EasyV4/)
  })
  it("postcheck : 4 contrôles OK ; service_role n'a toujours aucun droit d'écriture direct", async () => {
    const r = (await db.query<{ resultat: string }>(POST12)).rows
    expect(r).toHaveLength(4)
    expect(r.every((x) => x.resultat === "OK"), JSON.stringify(r)).toBe(true)
    await exec("SET ROLE service_role")
    await expect(exec(`INSERT INTO organizations (slug, name) VALUES ('direct','Direct')`)).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })
})

describe("création d'une entreprise", () => {
  it("avant 0011 : refusée (verrou 0010) et rien n'est écrit ; après 0011 : organisation + premier administrateur + audit", async () => {
    await expect(asService(() => call(SUPER, BOB_ADMIN))).rejects.toThrow(/0011/)
    await exec("ROLLBACK").catch(() => undefined)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations")).rows[0].n).toBe(1)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_staff WHERE user_id = $1", [BOB_ADMIN])).rows[0].n).toBe(0)

    await exec(M11)
    const org = (await asService(() => call(SUPER, BOB_ADMIN))).rows[0].id
    const staff = (await db.query<{ organization_id: string; role: string; email: string; active: boolean }>("SELECT * FROM landing_staff WHERE user_id = $1", [BOB_ADMIN])).rows[0]
    expect(staff).toMatchObject({ organization_id: org, role: "admin", email: "bob@bob.tn", active: true })
    const member = (await db.query<{ organization_id: string; role: string }>("SELECT * FROM organization_members WHERE user_id = $1", [BOB_ADMIN])).rows
    expect(member).toEqual([expect.objectContaining({ organization_id: org, role: "admin" })])
    const audit = (await db.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM organization_audit WHERE organization_id = $1 ORDER BY id", [org])).rows
    expect(audit.map((a) => a.action)).toContain("organization_provisioned")
    expect(audit.find((a) => a.action === "organization_provisioned")?.actor_id).toBe(SUPER)
    // Easy2Book n'a pas bougé
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organization_members WHERE organization_id = $1", [E2B])).rows[0].n).toBe(0)
  })

  it("refus : acteur qui n'est pas Super Admin, compte inconnu, compte déjà rattaché, identifiant d'organisation en double — et tout ou rien", async () => {
    await exec(M11)
    await expect(asService(() => call(STRANGER, BOB_ADMIN))).rejects.toThrow(/Super Admin/)
    await exec("ROLLBACK").catch(() => undefined)
    await expect(asService(() => call(SUPER, "cccccccc-0000-4000-8000-000000000009"))).rejects.toThrow(/introuvable/)
    await exec("ROLLBACK").catch(() => undefined)
    await asService(() => call(SUPER, BOB_ADMIN))
    await expect(asService(() => call(SUPER, BOB_ADMIN, "autre"))).rejects.toThrow(/déjà rattaché/)
    await exec("ROLLBACK").catch(() => undefined)
    await expect(asService(() => call(SUPER, CAROL_ADMIN, "bob"))).rejects.toThrow() // slug déjà pris
    await exec("ROLLBACK").catch(() => undefined)
    // l'échec n'a laissé aucune fiche d'équipe ni membre pour Carol (transaction unique)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_staff WHERE user_id = $1", [CAROL_ADMIN])).rows[0].n).toBe(0)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations")).rows[0].n).toBe(2)
  })

  it("anon et authenticated ne peuvent pas appeler les fonctions", async () => {
    await exec(M11)
    for (const role of ["anon", "authenticated"]) {
      await exec(`SET ROLE ${role}`)
      await expect(call(SUPER, BOB_ADMIN)).rejects.toThrow(/permission/)
      await exec("RESET ROLE")
    }
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations")).rows[0].n).toBe(1)
  })

  it("l'administrateur créé ne voit que SON entreprise (lecture avec son jeton)", async () => {
    await exec(M11)
    const org = (await asService(() => call(SUPER, BOB_ADMIN))).rows[0].id
    await exec(`INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, organization_id)
                VALUES ('E2B-AAAAAA','evt-00000001','Bob','21611111111','omra',true,'${org}'), ('E2B-BBBBBB','evt-00000002','Easy','21622222222','omra',true,'${E2B}')`)
    await exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${BOB_ADMIN}', false)`)
    const seen = (await db.query<{ ref: string }>("SELECT ref FROM landing_leads")).rows.map((r) => r.ref)
    await exec("RESET ROLE")
    expect(seen).toEqual(["E2B-AAAAAA"])
  })
})

describe("statut d'une organisation", () => {
  it("suspendre / réactiver tracé ; l'organisation de la plateforme est protégée ; réservé au Super Admin", async () => {
    await exec(M11)
    const org = (await asService(() => call(SUPER, BOB_ADMIN))).rows[0].id
    const set = (o: string, s: string, a = SUPER) => asService(() => db.query("SELECT public.landing_set_organization_status($1,$2,$3)", [o, s, a]))
    await set(org, "suspended")
    expect((await db.query<{ status: string }>("SELECT status FROM organizations WHERE id = $1", [org])).rows[0].status).toBe("suspended")
    await set(org, "active")
    const acts = (await db.query<{ action: string }>("SELECT action FROM organization_audit WHERE organization_id = $1", [org])).rows.map((r) => r.action)
    expect(acts).toEqual(expect.arrayContaining(["organization_suspended", "organization_reactivated"]))
    await expect(set(E2B, "suspended")).rejects.toThrow(/plateforme/)
    await exec("ROLLBACK").catch(() => undefined)
    await expect(set(org, "suspended", STRANGER)).rejects.toThrow(/Super Admin/)
    await exec("ROLLBACK").catch(() => undefined)
    await expect(set(org, "banni")).rejects.toThrow(/invalide/)
  })
})

describe("retour arrière et sabotage", () => {
  it("le retour arrière retire les fonctions sans toucher les organisations créées", async () => {
    await exec(M11)
    await asService(() => call(SUPER, BOB_ADMIN))
    await exec(R12)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations")).rows[0].n).toBe(2)
    await expect(asService(() => call(SUPER, CAROL_ADMIN, "c"))).rejects.toThrow()
  })
  it("sabotage : sans la vérification du Super Admin, le test de refus détecte la faille", async () => {
    await exec(M11)
    const broken = M12.replace(/IF NOT EXISTS \(SELECT 1 FROM public\.platform_admins WHERE user_id = p_actor\) THEN\s+RAISE EXCEPTION 'Réservé au Super Admin de la plateforme' USING ERRCODE = '42501';\s+END IF;/, "")
    expect(broken).not.toBe(M12)
    const d = new PGlite(); await d.exec(STUB + BEFORE + M11 + broken)
    await d.exec(`INSERT INTO auth.users (id, email) VALUES ('${STRANGER}','s@x.tn'),('${BOB_ADMIN}','b@x.tn')`)
    await d.exec("SET ROLE service_role")
    // la fonction saboteuse laisse n'importe qui créer une entreprise : exactement ce que le vrai test interdit
    await expect(d.query("SELECT public.landing_create_organization('B','bob','',$1,$2,'b@x.tn','B')", [STRANGER, BOB_ADMIN])).resolves.toBeTruthy()
  })
})
