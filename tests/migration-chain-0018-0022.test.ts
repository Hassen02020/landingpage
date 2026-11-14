import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// CHAÎNE COMPLÈTE 0001 → 0022 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) :
// données existantes INCHANGÉES après chaque migration, retour arrière complet dans l'ordre inverse, droits et sécurité par ligne, isolation entre entreprises.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const ALL = ["0001_landing_leads", "0002_landing_crm", "0003_landing_admin", "0004_landing_catalog", "0005_landing_team_templates", "0006_landing_qualification", "0007_landing_pipeline", "0008_multitenant_foundation", "0009_employees_see_org_leads", "0010_per_org_uniqueness_expand", "0011_per_org_uniqueness_contract", "0012_platform_organizations", "0013_manager_role", "0014_form_configs", "0015_meta_lead_pages", "0016_ad_economics", "0017_variable_costs"]
const NEW = ["0018_page_design", "0019_page_lang_en", "0020_page_versions", "0021_page_schedule", "0022_page_design_size"]
const ROLLBACKS = ["0022", "0021", "0020", "0019", "0018"].map((n) => read(`rollback/${n}_rollback.sql`))
const POSTCHECKS = Object.fromEntries(["0018", "0019", "0020", "0021", "0022"].map((n) => [n, read(`scripts/postcheck-${n}.sql`)]))
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
const U_E2B = "aaaaaaaa-0000-4000-8000-000000000001"
const U_BOB = "aaaaaaaa-0000-4000-8000-000000000002"
let db: PGlite
const exec = (s: string) => db.exec(s)
const fails = async (p: Promise<unknown>, re?: RegExp) => { await expect(p).rejects.toThrow(re); await exec("ROLLBACK").catch(() => undefined) }
/** empreinte des données EXISTANTES (colonnes d'avant 0018, hors horodatage de mise à jour) : doit rester identique après chaque migration */
const fingerprint = async () => {
  const q = async (sql: string) => JSON.stringify((await db.query(sql)).rows)
  return {
    categories: await q(`SELECT slug, name, product, lang, headline, description, banner_desktop, banner_mobile, seo_title, seo_description, visible, position, organization_id FROM landing_categories ORDER BY slug`),
    offers: await q(`SELECT name, sku, price, price_before, cost, seats_total, seats_sold, features, visible, archived_at, category_id, organization_id FROM landing_offers ORDER BY name`),
    leads: await q(`SELECT ref, first_name, phone, status, product, contact_consent, organization_id FROM landing_leads ORDER BY ref`),
  }
}
let before: Awaited<ReturnType<typeof fingerprint>>
let catE2B = "", catBob = ""

beforeAll(async () => {
  db = new PGlite()
  await exec(STUB + ALL.map((n) => read(`migrations/${n}.sql`)).join("\n"))
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL');
    INSERT INTO auth.users (id,email) VALUES ('${U_E2B}','a@x.tn'),('${U_BOB}','b@x.tn');
    INSERT INTO landing_staff (user_id,email,role,active,organization_id) VALUES ('${U_E2B}','a@x.tn','admin',true,'${E2B}'),('${U_BOB}','b@x.tn','admin',true,'${BOB}');
    INSERT INTO landing_categories (slug, name, product, lang, visible, position, organization_id) VALUES ('page-e2b','Page E2B','voyage','fr',true,3,'${E2B}'), ('page-ar','صفحة','omra','ar',false,0,'${E2B}'), ('page-bob','Page Bob','voyage','fr',true,1,'${BOB}')`)
  catE2B = (await db.query<{ id: string }>(`SELECT id FROM landing_categories WHERE slug='page-e2b'`)).rows[0].id
  catBob = (await db.query<{ id: string }>(`SELECT id FROM landing_categories WHERE slug='page-bob'`)).rows[0].id
  await exec(`INSERT INTO landing_offers (category_id, product, name, price, cost, seats_total, seats_sold, features, visible, organization_id) VALUES ('${catE2B}','voyage','Départ 1',2350.5,1800,20,7,'{Vol,Hôtel}',true,'${E2B}'), ('${catBob}','voyage','Offre Bob',100,60,5,1,'{}',true,'${BOB}')`)
  await exec(`INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, organization_id) VALUES ('E2B-Q22221','evt-00000001','Amel','21699000001','omra',true,'${E2B}'), ('E2B-Q22222','evt-00000002','Karim','21699000002','voyage',true,'${BOB}')`)
  before = await fingerprint()
}, 120000)

describe("chaîne 0018 → 0022 : données existantes", () => {
  it("chaque migration appliquée dans l'ordre laisse les catégories, offres (coût et places vendues compris) et prospects EXACTEMENT identiques", async () => {
    for (const n of NEW) {
      await exec(read(`migrations/${n}.sql`))
      expect(await fingerprint(), n).toEqual(before)
    }
  })
  it("les 5 scripts de contrôle ne signalent AUCUNE anomalie sur la chaîne complète", async () => {
    for (const [n, sql] of Object.entries(POSTCHECKS)) {
      const rows = (await db.query<{ resultat: string }>(sql)).rows
      expect(rows.length, n).toBeGreaterThanOrEqual(3)
      expect(rows.filter((r) => r.resultat.includes("À CORRIGER")), n).toEqual([])
    }
  })
  it("les pages FR et AR existantes gardent leur langue ; le français reste la valeur par défaut ; les nouvelles colonnes sont vides", async () => {
    expect((await db.query<{ slug: string; lang: string }>(`SELECT slug, lang FROM landing_categories WHERE slug IN ('page-e2b','page-ar') ORDER BY slug`)).rows).toEqual([{ slug: "page-ar", lang: "ar" }, { slug: "page-e2b", lang: "fr" }])
    await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('defaut','Défaut','omra','${E2B}')`)
    expect((await db.query<{ lang: string }>(`SELECT lang FROM landing_categories WHERE slug='defaut'`)).rows[0].lang).toBe("fr")
    expect((await db.query(`SELECT count(*)::int AS n FROM landing_categories WHERE design IS NOT NULL OR publish_at IS NOT NULL OR unpublish_at IS NOT NULL`)).rows[0]).toEqual({ n: 0 })
    expect((await db.query(`SELECT count(*)::int AS n FROM landing_page_versions`)).rows[0]).toEqual({ n: 0 })
    await exec(`DELETE FROM landing_categories WHERE slug = 'defaut'`).catch(() => undefined)
  })
})

describe("chaîne : sécurité par ligne, droits et isolation entre entreprises", () => {
  it("landing_page_versions : sécurité par ligne activée ET forcée, aucune politique, aucun droit pour anon / authenticated, service_role en lecture et ajout seulement", async () => {
    expect((await db.query(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forced FROM pg_class WHERE oid = 'public.landing_page_versions'::regclass`)).rows[0]).toEqual({ rls: true, forced: true })
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'landing_page_versions'`)).rows[0]).toEqual({ n: 0 })
    const priv = async (role: string, p: string) => (await db.query<{ v: boolean }>(`SELECT has_table_privilege('${role}', 'public.landing_page_versions', '${p}') AS v`)).rows[0].v
    for (const r of ["anon", "authenticated"]) for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) expect(await priv(r, p), `${r} ${p}`).toBe(false)
    expect({ s: await priv("service_role", "SELECT"), i: await priv("service_role", "INSERT"), u: await priv("service_role", "UPDATE"), d: await priv("service_role", "DELETE") }).toEqual({ s: true, i: true, u: false, d: false })
  })
  it("landing_categories : sécurité par ligne toujours forcée ; les nouvelles colonnes n'ouvrent AUCUN droit à anon / authenticated", async () => {
    expect((await db.query(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forced FROM pg_class WHERE oid = 'public.landing_categories'::regclass`)).rows[0]).toEqual({ rls: true, forced: true })
    for (const col of ["design", "publish_at", "unpublish_at", "lang"]) {
      for (const role of ["anon"]) expect((await db.query<{ v: boolean }>(`SELECT has_column_privilege('${role}', 'public.landing_categories', '${col}', 'SELECT') AS v`)).rows[0].v, `${role}.${col}`).toBe(false)
    }
  })
  it("un utilisateur connecté (membre d'une entreprise) ne lit AUCUNE version et ne peut pas en écrire", async () => {
    await exec(`INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${E2B}','${catE2B}',1,'enregistrement','{"v":1}')`)
    await exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U_E2B}',false)`)
    await fails(db.query(`SELECT * FROM landing_page_versions`), /permission/)
    await exec("RESET ROLE")
    await exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U_BOB}',false)`)
    await fails(db.query(`INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${BOB}','${catBob}',1,'enregistrement','{}')`), /permission/)
    await exec("RESET ROLE")
  })
  it("une version ne peut pas être rattachée à la page d'une AUTRE entreprise (dans les deux sens)", async () => {
    await fails(exec(`INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${BOB}','${catE2B}',9,'enregistrement','{}')`), /appartient/)
    await fails(exec(`INSERT INTO landing_page_versions (organization_id, category_id, version_number, reason, snapshot) VALUES ('${E2B}','${catBob}',9,'enregistrement','{}')`), /appartient/)
  })
  it("les pages d'une entreprise gardent leur organisation : changer l'organisation d'une page reste interdit après les migrations", async () => {
    await fails(exec(`UPDATE landing_categories SET organization_id = '${BOB}' WHERE slug = 'page-e2b'`), /immuable/i)
  })
})

describe("chaîne : retour arrière complet dans l'ordre inverse", () => {
  it("refusé tant que des données issues des nouvelles migrations existent ; puis 0022, 0021, 0020, 0019, 0018 se retirent sans toucher aux données existantes", async () => {
    await exec(`UPDATE landing_categories SET lang = 'en', design = jsonb_build_object('x', repeat('a', 30000)), publish_at = '2027-01-01T08:00:00Z' WHERE slug = 'page-e2b'`)
    await fails(exec(ROLLBACKS[0]), /16 000/)          // 0022 : design > 16 000 octets
    await exec(`UPDATE landing_categories SET design = '{"v":1}'::jsonb WHERE slug = 'page-e2b'`)
    await exec(ROLLBACKS[0])
    await fails(exec(ROLLBACKS[1]), /programmation/)   // 0021
    await exec(`UPDATE landing_categories SET publish_at = NULL WHERE slug = 'page-e2b'`)
    await exec(ROLLBACKS[1])
    await fails(exec(ROLLBACKS[2]), /versions/)        // 0020
    await exec(`DROP TRIGGER IF EXISTS landing_page_versions_org ON landing_page_versions; TRUNCATE landing_page_versions`)
    await exec(ROLLBACKS[2])
    await fails(exec(ROLLBACKS[3]), /anglais/)         // 0019
    await exec(`UPDATE landing_categories SET lang = 'fr' WHERE slug = 'page-e2b'`)
    await exec(ROLLBACKS[3])
    await fails(exec(ROLLBACKS[4]), /personnalisation/) // 0018
    await exec(`UPDATE landing_categories SET design = NULL`)
    await exec(ROLLBACKS[4])
    expect(await fingerprint()).toEqual(before)
    const cols = (await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='landing_categories' AND column_name IN ('design','publish_at','unpublish_at')`)).rows
    expect(cols).toEqual([])
    expect((await db.query(`SELECT to_regclass('public.landing_page_versions') AS t`)).rows[0]).toEqual({ t: null })
    await fails(exec(`INSERT INTO landing_categories (slug, name, product, lang, organization_id) VALUES ('en-apres','X','omra','en','${E2B}')`), /lang_check|check/i)
  })
  it("la chaîne est RÉ-APPLICABLE après un retour arrière complet (0018 → 0022)", async () => {
    for (const n of NEW) await exec(read(`migrations/${n}.sql`))
    expect(await fingerprint()).toEqual(before)
    for (const [n, sql] of Object.entries(POSTCHECKS)) expect((await db.query<{ resultat: string }>(sql)).rows.filter((r) => r.resultat.includes("À CORRIGER")), n).toEqual([])
  })
})
