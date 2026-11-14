import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0022 sur PostgreSQL de test : taille de la personnalisation. Ces essais ne prouvent rien sur la base de production.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map((f) => read(`migrations/${f}`)).join("\n")
const M18 = read("migrations/0018_page_design.sql"), M22 = read("migrations/0022_page_design_size.sql"), R22 = read("rollback/0022_rollback.sql"), POST22 = read("scripts/postcheck-0022.sql")
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
let db: PGlite
const exec = (s: string) => db.exec(s)
const fails = async (p: Promise<unknown>, re?: RegExp) => { await expect(p).rejects.toThrow(re); await exec("ROLLBACK").catch(() => undefined) }
const setDesign = (bytes: number) => exec(`UPDATE landing_categories SET design = jsonb_build_object('x', repeat('a', ${bytes})) WHERE slug = 'page-a'`)

beforeEach(async () => {
  db = new PGlite(); await exec(STUB + BEFORE + M18)
  await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('page-a','Page A','omra','${E2B}')`)
})

describe("0022 — taille de la personnalisation", () => {
  it("avant : 20 000 octets refusés ; après : acceptés jusqu'à 64 000 ; 70 000 refusés ; la forme (objet JSON) est toujours exigée", async () => {
    await fails(setDesign(20000), /design_check|check/i)
    await exec(M22)
    await setDesign(20000); await setDesign(60000)
    await fails(setDesign(70000), /design_check|check/i)
    await fails(exec(`UPDATE landing_categories SET design = '[1]'::jsonb WHERE slug='page-a'`), /design_check|check/i)
    await exec(`UPDATE landing_categories SET design = NULL WHERE slug='page-a'`)
  })
  it("garde-fous : 0018 requise, double exécution refusée, EasyV4 détectée", async () => {
    await exec(M22)
    await expect(exec(M22)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB + BEFORE)
    await expect(early.exec(M22)).rejects.toThrow(/0018/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + M18 + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M22)).rejects.toThrow(/EasyV4/)
  })
  it("les personnalisations existantes restent identiques ; contrôle : 3 lignes", async () => {
    await exec(`UPDATE landing_categories SET design = '{"v":1,"faq":[{"q":"a","a":"b"}]}'::jsonb WHERE slug='page-a'`)
    const before = (await db.query(`SELECT design FROM landing_categories WHERE slug='page-a'`)).rows
    await exec(M22)
    expect((await db.query(`SELECT design FROM landing_categories WHERE slug='page-a'`)).rows).toEqual(before)
    const rows = (await db.query<{ resultat: string }>(POST22)).rows
    expect(rows).toHaveLength(3); expect(rows.every((r) => !r.resultat.includes("À CORRIGER"))).toBe(true)
  })
  it("retour arrière : refusé si une personnalisation dépasse 16 000 octets, puis accepté ; ré-applicable", async () => {
    await exec(M22); await setDesign(30000)
    await fails(exec(R22), /16 000/)
    await setDesign(5000)
    await exec(R22)
    await fails(setDesign(20000), /design_check|check/i)
    await exec(M22)
  })
})
