import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0014 sur PostgreSQL (PGlite) : configuration du formulaire par entreprise + champs personnalisés.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map(M).join("\n")
const M14 = M("0014_form_configs.sql")
const R14 = read("rollback/0014_rollback.sql")
const POST14 = read("scripts/postcheck-0014.sql")
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
const BOB = "00000000-0000-4000-8000-0000000000b0"
const U_E2B = "aaaaaaaa-0000-4000-8000-000000000001"
const U_BOB = "aaaaaaaa-0000-4000-8000-000000000002"
let db: PGlite
const exec = (s: string) => db.exec(s)
let n = 0
const lead = (org: string, extra = "") => exec(`INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, organization_id${extra ? ", custom_fields" : ""})
  VALUES ('E2B-Q${String(++n).padStart(5, "2")}','evt-${String(n).padStart(8, "0")}','A','2169900${String(n).padStart(4, "0")}','omra',true,'${org}'${extra ? `, '${extra}'::jsonb` : ""})`)
const asUser = async (id: string) => exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false)`)

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await exec(STUB + BEFORE)
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL');
              INSERT INTO auth.users (id,email) VALUES ('${U_E2B}','a@x.tn'),('${U_BOB}','b@x.tn');
              INSERT INTO landing_staff (user_id,email,role,active,organization_id) VALUES ('${U_E2B}','a@x.tn','admin',true,'${E2B}'),('${U_BOB}','b@x.tn','admin',true,'${BOB}')`)
})

describe("0014", () => {
  it("garde-fous : EasyV4, 0008 requise, double exécution refusée", async () => {
    await exec(M14)
    await expect(exec(M14)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M14)).rejects.toThrow(/0008/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M14)).rejects.toThrow(/EasyV4/)
  })
  it("postcheck : 5 OK après ; À CORRIGER avant ; les leads existants sont intacts", async () => {
    await lead(E2B)
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n
    expect((await db.query<{ resultat: string }>(POST14)).rows.some((r) => r.resultat === "À CORRIGER")).toBe(true)
    await exec(M14)
    const r = (await db.query<{ resultat: string }>(POST14)).rows
    expect(r).toHaveLength(5)
    expect(r.every((x) => x.resultat === "OK"), JSON.stringify(r)).toBe(true)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n).toBe(before)
    expect((await db.query<{ c: unknown }>("SELECT custom_fields AS c FROM landing_leads")).rows[0].c).toBeNull()
  })
  it("custom_fields : objet JSON borné (une liste, un texte ou plus de 4 000 caractères sont refusés)", async () => {
    await exec(M14)
    await lead(E2B, '{"c1":"Paris"}')
    await expect(lead(E2B, '["a"]')).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await expect(lead(E2B, JSON.stringify({ c1: "x".repeat(4100) }))).rejects.toThrow()
  })
  it("configuration : une ligne par organisation ; l'organisation d'une ligne ne change jamais ; pas de suppression", async () => {
    await exec(M14)
    await exec(`INSERT INTO landing_form_configs (organization_id, config) VALUES ('${E2B}','{"fields":{}}'), ('${BOB}','{"fields":{"email":{"required":true}}}')`)
    await expect(exec(`INSERT INTO landing_form_configs (organization_id, config) VALUES ('${BOB}','{}')`)).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await expect(exec(`UPDATE landing_form_configs SET organization_id = '${E2B}' WHERE organization_id = '${BOB}'`)).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await expect(exec(`INSERT INTO landing_form_configs (organization_id, config) VALUES ('${E2B}','[1]')`)).rejects.toThrow()
    await exec("SET ROLE service_role")
    await expect(exec(`DELETE FROM landing_form_configs`)).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })
  it("isolation : un membre lit SA configuration seulement ; anon rien ; aucune écriture avec un jeton de compte", async () => {
    await exec(M14)
    await exec(`INSERT INTO landing_form_configs (organization_id, config) VALUES ('${E2B}','{"nom":"e2b"}'), ('${BOB}','{"nom":"bob"}')`)
    await asUser(U_BOB)
    expect((await db.query<{ c: { nom: string } }>("SELECT config AS c FROM landing_form_configs")).rows.map((r) => r.c.nom)).toEqual(["bob"])
    await expect(exec(`UPDATE landing_form_configs SET config = '{}'`)).rejects.toThrow()
    await exec("RESET ROLE; SET ROLE anon")
    await expect(exec("SELECT 1 FROM landing_form_configs")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })
  it("anonymisation : custom_fields est effacé avec le reste des données personnelles", async () => {
    await exec(M14)
    await lead(E2B, '{"c1":"donnée personnelle"}')
    await exec(`UPDATE landing_leads SET last_activity_at = now() - interval '30 months', status = 'nouveau'`)
    await exec("SELECT public.landing_purge_personal_data()")
    const r = (await db.query<{ c: unknown; fn: string }>("SELECT custom_fields AS c, first_name AS fn FROM landing_leads")).rows[0]
    expect(r.fn).toBe("Anonymisé")
    expect(r.c).toBeNull()
  })
  it("sabotage : si la fonction d'anonymisation oubliait custom_fields, le test le détecte", async () => {
    await exec(M14.replace("region = NULL, custom_fields = NULL,", "region = NULL,"))
    await lead(E2B, '{"c1":"donnée personnelle"}')
    await exec(`UPDATE landing_leads SET last_activity_at = now() - interval '30 months', status = 'nouveau'`)
    await exec("SELECT public.landing_purge_personal_data()")
    expect((await db.query<{ c: unknown }>("SELECT custom_fields AS c FROM landing_leads")).rows[0].c).not.toBeNull() // la fuite que le vrai test interdit
  })
  it("retour arrière : refusé s'il existe des réponses personnalisées ; sinon propre, ancienne fonction restaurée", async () => {
    await exec(M14)
    await lead(E2B, '{"c1":"x"}')
    await expect(exec(R14)).rejects.toThrow(/réponses personnalisées/)
    await exec("ROLLBACK").catch(() => undefined)
    await exec("UPDATE landing_leads SET custom_fields = NULL")
    await exec(R14)
    expect(await db.query("SELECT to_regclass('public.landing_form_configs') AS t").then((r) => (r.rows[0] as { t: unknown }).t)).toBeNull()
    const def = (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.landing_purge_personal_data()'::regprocedure) AS d")).rows[0].d
    expect(def).not.toContain("custom_fields")
  })
})
