import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0015 sur PostgreSQL (PGlite) : configuration du formulaire par entreprise + champs personnalisés.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map(M).join("\n")
const M14 = M("0014_form_configs.sql")
const M15 = M("0015_meta_lead_pages.sql")
const R15 = read("rollback/0015_rollback.sql")
const POST15 = read("scripts/postcheck-0015.sql")
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

describe("0015", () => {
  beforeEach(async () => { await exec(M14) })
  it("garde-fous : EasyV4, 0008 requise, double exécution refusée", async () => {
    await exec(M15)
    await expect(exec(M15)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M15)).rejects.toThrow(/0008/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M15)).rejects.toThrow(/EasyV4/)
  })
  it("postcheck : 4 OK après, À CORRIGER avant", async () => {
    expect((await db.query<{ resultat: string }>(POST15)).rows.some((r) => r.resultat === "À CORRIGER")).toBe(true)
    await exec(M15)
    const r = (await db.query<{ resultat: string }>(POST15)).rows
    expect(r).toHaveLength(4)
    expect(r.every((x) => x.resultat === "OK"), JSON.stringify(r)).toBe(true)
  })
  const CT = "v1:AAAA:BBBB:CCCC"
  const page = (id: string, org: string, extra = "") => exec(`INSERT INTO landing_meta_pages (page_id, organization_id, token_ciphertext, token_last4${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('${id}','${org}','${CT}','abcd'${extra ? ", " + extra.split("=")[1] : ""})`)
  it("une page appartient à UNE seule entreprise (page_id unique sur toute la plateforme)", async () => {
    await exec(M15)
    await page("1234567890", E2B)
    await expect(page("1234567890", BOB)).rejects.toThrow()
  })
  it("identifiant de page, jeton chiffré et quatre derniers caractères validés", async () => {
    await exec(M15)
    await expect(page("abc", E2B)).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await expect(exec(`INSERT INTO landing_meta_pages (page_id, organization_id, token_ciphertext, token_last4) VALUES ('1234567890','${E2B}','jeton-en-clair','abcd')`)).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await expect(exec(`INSERT INTO landing_meta_pages (page_id, organization_id, token_ciphertext, token_last4) VALUES ('1234567890','${E2B}','${CT}','abcde')`)).rejects.toThrow()
  })
  it("par défaut : désactivée et consentement NON confirmé ; l'entreprise d'une page ne change jamais ; pas de suppression", async () => {
    await exec(M15)
    await page("1234567890", E2B)
    const r = (await db.query<{ enabled: boolean; consent_confirmed: boolean }>("SELECT enabled, consent_confirmed FROM landing_meta_pages")).rows[0]
    expect(r).toEqual({ enabled: false, consent_confirmed: false })
    await expect(exec(`UPDATE landing_meta_pages SET organization_id = '${BOB}'`)).rejects.toThrow()
    await exec("ROLLBACK").catch(() => undefined)
    await exec("SET ROLE service_role")
    await expect(exec("DELETE FROM landing_meta_pages")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })
  it("aucun accès pour un compte d'utilisateur ni pour anon (le jeton chiffré reste côté serveur)", async () => {
    await exec(M15)
    await page("1234567890", E2B)
    await asUser(U_E2B)
    await expect(exec("SELECT token_ciphertext FROM landing_meta_pages")).rejects.toThrow(/permission/)
    await exec("RESET ROLE; SET ROLE anon")
    await expect(exec("SELECT 1 FROM landing_meta_pages")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })
  it("retour arrière : refusé si une page est activée ; sinon propre", async () => {
    await exec(M15)
    await page("1234567890", E2B, "enabled=true")
    await expect(exec(R15)).rejects.toThrow(/activées/)
    await exec("ROLLBACK").catch(() => undefined)
    await exec("UPDATE landing_meta_pages SET enabled = false")
    await exec(R15)
    expect(await db.query("SELECT to_regclass('public.landing_meta_pages') AS t").then((r) => (r.rows[0] as { t: unknown }).t)).toBeNull()
  })
})
