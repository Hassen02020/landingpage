import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0024 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) :
// 0023 (journal des événements entrants) et 0024 (numéros WhatsApp) : garde-fous, postchecks, droits, isolation, retours arrière.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = ["0001_landing_leads", "0002_landing_crm", "0003_landing_admin", "0004_landing_catalog", "0005_landing_team_templates", "0006_landing_qualification", "0007_landing_pipeline", "0008_multitenant_foundation", "0009_employees_see_org_leads", "0010_per_org_uniqueness_expand", "0011_per_org_uniqueness_contract", "0012_platform_organizations", "0013_manager_role", "0014_form_configs", "0015_meta_lead_pages", "0016_ad_economics", "0017_variable_costs"]
const M23 = read("migrations/0023_inbound_events.sql")
const M24 = read("migrations/0024_whatsapp_numbers.sql")
const R23 = read("rollback/0023_rollback.sql")
const R24 = read("rollback/0024_rollback.sql")
const P23 = read("scripts/postcheck-0023.sql")
const P24 = read("scripts/postcheck-0024.sql")
const STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now(), banned_until timestamptz, created_at timestamptz DEFAULT now());
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`
const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
let db: PGlite
const exec = (s: string) => db.exec(s)
const fails = async (p: Promise<unknown>, re?: RegExp) => { await expect(p).rejects.toThrow(re); await exec("ROLLBACK").catch(() => undefined) }
const post = async (sql: string) => (await db.query<{ resultat: string }>(sql)).rows.map((r) => r.resultat)

beforeAll(async () => {
  db = new PGlite()
  await exec(STUB)
  for (const f of CHAIN) await exec(read(`migrations/${f}.sql`))
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`).catch(() => undefined)
}, 120_000)

describe("0023 — journal des événements entrants", () => {
  it("postcheck : À CORRIGER avant, 4 OK après", async () => {
    expect((await post(P23)).includes("À CORRIGER")).toBe(true)
    await exec(M23)
    const r = await post(P23)
    expect(r).toHaveLength(4)
    expect(r.every((x) => x === "OK"), JSON.stringify(r)).toBe(true)
  })
  it("garde-fous : double exécution refusée ; base EasyV4 refusée ; 0008 requise", async () => {
    await fails(exec(M23), /déjà/)
    const other = new PGlite(); await other.exec(STUB + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M23)).rejects.toThrow(/EasyV4/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M23)).rejects.toThrow(/0008/)
  })
  it("contraintes : plateforme, état et longueurs bornés ; entreprise obligatoire et existante", async () => {
    const ins = (cols: string, vals: string) => exec(`INSERT INTO landing_inbound_events (${cols}) VALUES (${vals})`)
    await ins("organization_id, platform, external_id, status", `'${E2B}','facebook','123456','created'`)
    await fails(ins("organization_id, platform, external_id, status", `'${E2B}','linkedin','1','created'`), /check/i)
    await fails(ins("organization_id, platform, external_id, status", `'${E2B}','facebook','1','perdu'`), /check/i)
    await fails(ins("organization_id, platform, external_id, status", `'${E2B}','facebook','${"x".repeat(101)}','created'`), /check/i)
    await fails(ins("platform, external_id, status", `'facebook','1','created'`), /null/i)
    await fails(ins("organization_id, platform, external_id, status", `'99999999-0000-4000-8000-000000000000','facebook','1','created'`), /foreign key|clé étrangère/i)
  })
  it("droits : le serveur lit et ajoute seulement ; ni anon ni comptes connectés ; registre à ajout seul", async () => {
    await exec("SET ROLE service_role")
    await exec(`INSERT INTO landing_inbound_events (organization_id, platform, external_id, status, reason) VALUES ('${BOB}','whatsapp','wamid.1','ignored','numero_desactive')`)
    expect((await db.query("SELECT count(*)::int AS n FROM landing_inbound_events")).rows[0]).toMatchObject({ n: 2 })
    await fails(exec("UPDATE landing_inbound_events SET status='created'"), /permission/i)
    await exec("SET ROLE service_role")
    await fails(exec("DELETE FROM landing_inbound_events"), /permission/i)
    await exec("RESET ROLE")
    for (const role of ["anon", "authenticated"]) {
      await exec(`SET ROLE ${role}`)
      await fails(db.query("SELECT 1 FROM landing_inbound_events"), /permission/i)
      await exec("RESET ROLE")
    }
  })
  it("l'entreprise d'une ligne est immuable", async () => {
    await fails(exec(`UPDATE landing_inbound_events SET organization_id='${E2B}' WHERE organization_id='${BOB}'`), /immuable/i)
  })
  it("retour arrière : refusé tant que le journal contient des lignes ; accepté une fois vide", async () => {
    await fails(exec(R23), /contient des lignes/)
    await exec("DELETE FROM landing_inbound_events")
    await exec(R23)
    expect((await post(P23)).includes("À CORRIGER")).toBe(true)
    await exec(M23) // réapplicable
    expect((await post(P23)).every((x) => x === "OK")).toBe(true)
  })
})

describe("0024 — numéros WhatsApp Business", () => {
  it("postcheck : À CORRIGER avant, 4 OK après ; garde-fous", async () => {
    expect((await post(P24)).includes("À CORRIGER")).toBe(true)
    await exec(M24)
    const r = await post(P24)
    expect(r).toHaveLength(4)
    expect(r.every((x) => x === "OK"), JSON.stringify(r)).toBe(true)
    await fails(exec(M24), /déjà/)
    const other = new PGlite(); await other.exec(STUB + "CREATE TABLE public.reservations (id int);")
    await expect(other.exec(M24)).rejects.toThrow(/EasyV4/)
  })
  it("un numéro appartient à UNE entreprise ; désactivé par défaut ; identifiant borné", async () => {
    await exec(`INSERT INTO landing_whatsapp_numbers (phone_number_id, organization_id) VALUES ('200000000000001','${E2B}')`)
    expect((await db.query("SELECT enabled FROM landing_whatsapp_numbers")).rows[0]).toEqual({ enabled: false })
    await fails(exec(`INSERT INTO landing_whatsapp_numbers (phone_number_id, organization_id) VALUES ('200000000000001','${BOB}')`), /duplicate|unique|pkey/i)
    await fails(exec(`INSERT INTO landing_whatsapp_numbers (phone_number_id, organization_id) VALUES ('abc','${BOB}')`), /check/i)
    await fails(exec(`UPDATE landing_whatsapp_numbers SET organization_id='${BOB}'`), /immuable/i)
  })
  it("droits : le serveur lit et écrit sans supprimer ; ni anon ni comptes connectés", async () => {
    await exec("SET ROLE service_role")
    await exec("UPDATE landing_whatsapp_numbers SET enabled = true")
    await fails(exec("DELETE FROM landing_whatsapp_numbers"), /permission/i)
    for (const role of ["anon", "authenticated"]) {
      await exec(`SET ROLE ${role}`)
      await fails(db.query("SELECT 1 FROM landing_whatsapp_numbers"), /permission/i)
      await exec("RESET ROLE")
    }
    await exec("RESET ROLE")
  })
  it("retour arrière : refusé tant qu'un numéro est activé", async () => {
    await fails(exec(R24), /activés/)
    await exec("UPDATE landing_whatsapp_numbers SET enabled = false")
    await exec(R24)
    expect((await post(P24)).includes("À CORRIGER")).toBe(true)
  })
})
