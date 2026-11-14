import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0019 sur PostgreSQL de test : langue anglaise des pages. Ces essais ne prouvent rien sur la base de production.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map((f) => read(`migrations/${f}`)).join("\n")
const M19 = read("migrations/0019_page_lang_en.sql"), R19 = read("rollback/0019_rollback.sql"), POST19 = read("scripts/postcheck-0019.sql")
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
const ins = (slug: string, lang: string) => exec(`INSERT INTO landing_categories (slug, name, product, lang, organization_id) VALUES ('${slug}','Page ${slug}','omra','${lang}','${E2B}')`)

beforeEach(async () => { db = new PGlite(); await exec(STUB + BEFORE) })

describe("0019 — langue anglaise", () => {
  it("avant : « en » refusé ; après : fr, ar, en acceptés ; autre langue toujours refusée", async () => {
    await fails(ins("avant-en", "en"), /lang_check|check/i)
    await exec(M19)
    for (const l of ["fr", "ar", "en"]) await ins(`apres-${l}`, l)
    await fails(ins("apres-de", "de"), /lang_check|check/i)
  })
  it("garde-fous : EasyV4, table requise, double exécution refusée", async () => {
    await exec(M19)
    await expect(exec(M19)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M19)).rejects.toThrow(/0004/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M19)).rejects.toThrow(/EasyV4/)
  })
  it("pages existantes inchangées, valeur par défaut inchangée (fr)", async () => {
    const before = (await db.query(`SELECT slug, lang, visible, updated_at FROM landing_categories ORDER BY slug`)).rows
    await exec(M19)
    expect((await db.query(`SELECT slug, lang, visible, updated_at FROM landing_categories ORDER BY slug`)).rows).toEqual(before)
    await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('defaut','Défaut','omra','${E2B}')`)
    expect((await db.query<{ lang: string }>(`SELECT lang FROM landing_categories WHERE slug='defaut'`)).rows[0].lang).toBe("fr")
  })
  it("contrôle : 3 lignes sans « À CORRIGER » ; retour arrière refusé s'il existe une page en anglais, puis accepté", async () => {
    await exec(M19)
    const rows = (await db.query<{ resultat: string }>(POST19)).rows
    expect(rows).toHaveLength(3); expect(rows.every((r) => !r.resultat.includes("À CORRIGER"))).toBe(true)
    await ins("page-en", "en")
    await fails(exec(R19), /anglais/)
    await exec(`UPDATE landing_categories SET lang = 'fr' WHERE slug = 'page-en'`)
    await exec(R19)
    await fails(ins("apres-retour", "en"), /lang_check|check/i)
    await exec(M19) // ré-applicable
  })
})
