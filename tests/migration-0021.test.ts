import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0021 sur PostgreSQL de test : publication programmée. Ces essais ne prouvent rien sur la base de production.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map((f) => read(`migrations/${f}`)).join("\n")
const M21 = read("migrations/0021_page_schedule.sql"), R21 = read("rollback/0021_rollback.sql"), POST21 = read("scripts/postcheck-0021.sql")
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

beforeEach(async () => { db = new PGlite(); await exec(STUB + BEFORE); await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('page-a','Page A','omra','${E2B}')`) })

describe("0021 — publication programmée", () => {
  it("garde-fous : EasyV4, prérequis, double exécution refusée", async () => {
    await exec(M21)
    await expect(exec(M21)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M21)).rejects.toThrow(/0004/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M21)).rejects.toThrow(/EasyV4/)
  })
  it("pages existantes INCHANGÉES (colonnes NULL, sans valeur par défaut) ; le masquage doit suivre la publication", async () => {
    const before = (await db.query(`SELECT slug, name, visible, updated_at FROM landing_categories ORDER BY slug`)).rows
    await exec(M21)
    expect((await db.query(`SELECT slug, name, visible, updated_at FROM landing_categories ORDER BY slug`)).rows).toEqual(before)
    expect((await db.query(`SELECT publish_at, unpublish_at FROM landing_categories`)).rows[0]).toEqual({ publish_at: null, unpublish_at: null })
    await exec(`UPDATE landing_categories SET publish_at = '2027-01-01T08:00:00Z', unpublish_at = '2027-02-01T08:00:00Z'`)
    await fails(exec(`UPDATE landing_categories SET unpublish_at = '2026-12-01T08:00:00Z'`), /schedule_check|check/i)
    await exec(`UPDATE landing_categories SET publish_at = NULL, unpublish_at = '2026-12-01T08:00:00Z'`)
  })
  it("contrôle : 3 lignes ; retour arrière refusé s'il existe une programmation, puis accepté", async () => {
    await exec(M21)
    const rows = (await db.query<{ resultat: string }>(POST21)).rows
    expect(rows).toHaveLength(3); expect(rows.every((r) => !r.resultat.includes("À CORRIGER"))).toBe(true)
    await exec(`UPDATE landing_categories SET publish_at = '2027-01-01T08:00:00Z'`)
    await fails(exec(R21), /programmation/)
    await exec(`UPDATE landing_categories SET publish_at = NULL`)
    await exec(R21)
    expect((await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='landing_categories' AND column_name='publish_at'`)).rows).toHaveLength(0)
    await exec(M21)
  })
})
