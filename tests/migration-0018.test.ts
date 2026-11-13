import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0018 sur PostgreSQL (PGlite) : colonne design de landing_categories. Ces essais ne prouvent rien sur la base de production.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map((f) => read(`migrations/${f}`)).join("\n")
const M18 = read("migrations/0018_page_design.sql")
const R18 = read("rollback/0018_rollback.sql")
const POST18 = read("scripts/postcheck-0018.sql")
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

beforeEach(async () => {
  db = new PGlite()
  await exec(STUB + BEFORE)
  await exec(`INSERT INTO landing_categories (slug, name, product, visible, organization_id) VALUES ('brouillon','Brouillon','voyage',false,'${E2B}')`)
})

describe("0018 — colonne design", () => {
  it("garde-fous : EasyV4, tables requises, double exécution refusée", async () => {
    await exec(M18)
    await expect(exec(M18)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M18)).rejects.toThrow(/0004/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M18)).rejects.toThrow(/EasyV4/)
  })
  it("pages existantes INCHANGÉES : design NULL, aucune autre colonne modifiée, aucune valeur par défaut", async () => {
    const before = (await db.query(`SELECT slug, name, product, visible, position, updated_at FROM landing_categories ORDER BY slug`)).rows
    await exec(M18)
    const after = (await db.query(`SELECT slug, name, product, visible, position, updated_at FROM landing_categories ORDER BY slug`)).rows
    expect(after).toEqual(before)
    expect(Number((await db.query<{ n: string }>(`SELECT count(*) AS n FROM landing_categories WHERE design IS NOT NULL`)).rows[0].n)).toBe(0)
    const col = (await db.query<{ column_default: string | null; is_nullable: string }>(`SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name='landing_categories' AND column_name='design'`)).rows[0]
    expect(col).toEqual({ column_default: null, is_nullable: "YES" })
  })
  it("la base n'accepte qu'un objet JSON de taille bornée ; un objet valide est relu tel quel", async () => {
    await exec(M18)
    await exec(`UPDATE landing_categories SET design = '{"v":1,"faq":[{"q":"a","a":"b"}]}'::jsonb WHERE slug='brouillon'`)
    expect((await db.query<{ d: { v: number } }>(`SELECT design AS d FROM landing_categories WHERE slug='brouillon'`)).rows[0].d.v).toBe(1)
    await fails(exec(`UPDATE landing_categories SET design = '[1,2]'::jsonb WHERE slug='brouillon'`), /design_check/)
    await fails(exec(`UPDATE landing_categories SET design = '"texte"'::jsonb WHERE slug='brouillon'`), /design_check/)
    await fails(exec(`UPDATE landing_categories SET design = jsonb_build_object('x', repeat('a', 20000)) WHERE slug='brouillon'`), /design_check/)
  })
  it("droits inchangés : service_role lit et modifie, anon et authenticated n'accèdent pas à la table", async () => {
    await exec(M18)
    await exec(`SET ROLE service_role; UPDATE landing_categories SET design = '{"v":1}'::jsonb WHERE slug='brouillon'; RESET ROLE`)
    await fails(exec(`SET ROLE anon; SELECT design FROM landing_categories`), /permission/)
    await fails(exec(`SET ROLE authenticated; SELECT design FROM landing_categories`), /permission/)
  })
  it("contrôle postcheck : 4 lignes, aucune « À CORRIGER »", async () => {
    await exec(M18)
    const rows = (await db.query<{ resultat: string }>(POST18)).rows
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => !r.resultat.includes("À CORRIGER"))).toBe(true)
  })
  it("retour arrière : refusé si une personnalisation existe ; sinon la colonne disparaît et les pages restent intactes", async () => {
    await exec(M18)
    await exec(`UPDATE landing_categories SET design = '{"v":1}'::jsonb WHERE slug='brouillon'`)
    await fails(exec(R18), /personnalisation/)
    await exec(`UPDATE landing_categories SET design = NULL`)
    await exec(R18)
    expect((await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='landing_categories' AND column_name='design'`)).rows).toHaveLength(0)
    expect(Number((await db.query<{ n: string }>(`SELECT count(*) AS n FROM landing_categories WHERE slug IN ('omra-2027','brouillon')`)).rows[0].n)).toBe(2)
    await exec(M18) // ré-applicable après retour arrière
  })
})
