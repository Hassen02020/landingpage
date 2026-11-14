import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0020 sur PostgreSQL de test : historique des versions (registre à ajout seul). Ces essais ne prouvent rien sur la base de production.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map((f) => read(`migrations/${f}`)).join("\n")
const M20 = read("migrations/0020_page_versions.sql"), R20 = read("rollback/0020_rollback.sql"), POST20 = read("scripts/postcheck-0020.sql")
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
let catE2B = "", catBob = ""
const version = (org: string, cat: string, n: number, snap = `'{"category":{"name":"X"}}'`, reason = "enregistrement") =>
  exec(`INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${org}','${cat}',${n},'${reason}',${snap}::jsonb)`)

beforeEach(async () => {
  db = new PGlite(); await exec(STUB + BEFORE)
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`)
  await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('page-a','Page A','omra','${E2B}'), ('page-b','Page B','omra','${BOB}')`)
  catE2B = (await db.query<{ id: string }>(`SELECT id FROM landing_categories WHERE slug='page-a'`)).rows[0].id
  catBob = (await db.query<{ id: string }>(`SELECT id FROM landing_categories WHERE slug='page-b'`)).rows[0].id
})

describe("0020 — historique des versions", () => {
  it("garde-fous : EasyV4, prérequis, double exécution refusée", async () => {
    await exec(M20)
    await expect(exec(M20)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M20)).rejects.toThrow(/0004/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M20)).rejects.toThrow(/EasyV4/)
  })
  it("ajout et lecture ; numéro unique par page ; motif et instantané contrôlés", async () => {
    await exec(M20)
    await version(E2B, catE2B, 1); await version(E2B, catE2B, 2, `'{"a":1}'`, "publication")
    await fails(version(E2B, catE2B, 2), /unique|duplicate/i)
    await fails(version(E2B, catE2B, 3, `'{"a":1}'`, "inconnu"), /reason_check|check/i)
    await fails(version(E2B, catE2B, 3, `'[1]'`), /snapshot_check|check/i)
    await fails(version(E2B, catE2B, 3, `jsonb_build_object('x', repeat('a', 120000))`), /snapshot_check|check/i)
    expect((await db.query(`SELECT 1 FROM landing_page_versions`)).rows).toHaveLength(2)
  })
  it("une version ne peut pas être rattachée à la page d'UNE AUTRE entreprise", async () => {
    await exec(M20)
    await fails(version(BOB, catE2B, 1), /n'appartient pas|appartient/i)
    await fails(version(E2B, catBob, 1), /n'appartient pas|appartient/i)
    await version(BOB, catBob, 1)
  })
  it("registre à ajout seul : service_role ne peut ni modifier ni supprimer ; anon sans accès", async () => {
    await exec(M20); await version(E2B, catE2B, 1)
    await fails(exec(`SET ROLE service_role; UPDATE landing_page_versions SET note = 'x'`), /permission/)
    await fails(exec(`SET ROLE service_role; DELETE FROM landing_page_versions`), /permission/)
    await fails(exec(`SET ROLE anon; SELECT * FROM landing_page_versions`), /permission/)
    await exec(`SET ROLE service_role; INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${E2B}','${catE2B}',2,'enregistrement','{}'); RESET ROLE`)
  })
  it("pages existantes inchangées ; contrôle : 4 lignes ; retour arrière refusé si des versions existent, puis accepté", async () => {
    const before = (await db.query(`SELECT slug, name, visible, updated_at FROM landing_categories ORDER BY slug`)).rows
    await exec(M20)
    expect((await db.query(`SELECT slug, name, visible, updated_at FROM landing_categories ORDER BY slug`)).rows).toEqual(before)
    const rows = (await db.query<{ resultat: string }>(POST20)).rows
    expect(rows).toHaveLength(4); expect(rows.every((r) => !r.resultat.includes("À CORRIGER"))).toBe(true)
    await version(E2B, catE2B, 1)
    await fails(exec(R20), /versions/)
    await exec(`TRUNCATE landing_page_versions`)
    await exec(R20)
    expect((await db.query(`SELECT to_regclass('public.landing_page_versions') AS t`)).rows[0]).toEqual({ t: null })
    await exec(M20)
  })
})
