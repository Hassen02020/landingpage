import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0011 sur PostgreSQL (PGlite) : unicités PAR ORGANISATION (élargir 0010, resserrer 0011), fonction promo, vues, garde-fou, retours arrière.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql"].map(M).join("\n")
const M10 = M("0010_per_org_uniqueness_expand.sql")
const M11 = M("0011_per_org_uniqueness_contract.sql")
const R10 = read("rollback/0010_rollback.sql")
const R11 = read("rollback/0011_rollback.sql")
const POST10 = read("scripts/postcheck-0010.sql")
const POST11 = read("scripts/postcheck-0011.sql")
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
let db: PGlite
let n = 0

const exec = (sql: string) => db.exec(sql)
async function lead(org: string | null, o: Record<string, unknown> = {}) {
  n++
  const row: Record<string, unknown> = { ref: `E2B-QQ${String(n).padStart(4, "2")}`, idempotency_key: `evt-${String(n).padStart(8, "0")}`, first_name: "Test", phone: `2169911${String(n).padStart(4, "0")}`, product: "omra", contact_consent: true, ...o }
  if (org) row.organization_id = org
  const k = Object.keys(row)
  return db.query(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))
}
async function secondOrg() {
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}', 'bob', 'Bob SARL')`)
}

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await exec(STUB)
  await exec(BEFORE)
})

describe("0010 (élargir) : garde-fous et absence de changement de comportement", () => {
  it("exige 0008, refuse une seconde exécution et une base EasyV4", async () => {
    const early = new PGlite()
    await early.exec(STUB + BEFORE.split("-- Easy2Book landing — 0008")[0].slice(0, 0))
    await expect(early.exec(M10)).rejects.toThrow(/0008/)
    await exec(M10)
    await expect(exec(M10)).rejects.toThrow(/déjà/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M10)).rejects.toThrow(/EasyV4/)
  })

  it("après 0010 : les unicités globales restent en place ET les unicités par organisation existent ; données intactes", async () => {
    await lead(null)
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n
    await exec(M10)
    const idx = (await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.indexname)
    for (const old of ["landing_leads_idempotency_key_uq", "landing_leads_phone_product_day_uq", "landing_events_event_id_uq", "landing_leads_ref_uq"]) expect(idx, old).toContain(old)
    for (const nw of ["landing_leads_org_idempotency_uq", "landing_leads_org_phone_product_day_uq", "landing_events_org_event_id_uq", "landing_integrations_org_provider_uq", "landing_blocklist_org_kind_value_uq", "landing_protection_org_uq", "landing_promo_codes_org_code_uq", "landing_categories_org_slug_uq", "landing_offers_org_sku_uq"]) expect(idx, nw).toContain(nw)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n).toBe(before)
    // l'ancien comportement (une seule organisation, valeur par défaut Easy2Book) fonctionne toujours
    await lead(null)
    expect((await db.query<{ organization_id: string }>("SELECT DISTINCT organization_id FROM landing_leads")).rows).toEqual([{ organization_id: E2B }])
  })

  it("GARDE-FOU : une deuxième organisation est REFUSÉE tant que 0011 n'est pas appliquée (les unicités globales feraient entrer les entreprises en conflit)", async () => {
    await exec(M10)
    await expect(secondOrg()).rejects.toThrow(/0011/)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations")).rows[0].n).toBe(1)
  })

  it("les deux fonctions promo coexistent : l'ancienne (2 arguments) et la nouvelle (3 arguments, par organisation)", async () => {
    await exec(M10)
    await exec(`INSERT INTO landing_promo_codes (code, title, discount_type, discount_value) VALUES ('RAMADAN27', 'Ramadan', 'percent', 10)`)
    const old = await db.query("SELECT * FROM landing_redeem_promo('ramadan27', 'omra')")
    expect(old.rows.length).toBe(1)
    const nw = await db.query(`SELECT * FROM landing_redeem_promo('RAMADAN27', 'omra', '${E2B}')`)
    expect(nw.rows.length).toBe(1)
    expect((await db.query<{ used_count: number }>("SELECT used_count FROM landing_promo_codes")).rows[0].used_count).toBe(2)
    expect((await db.query(`SELECT * FROM landing_redeem_promo('RAMADAN27', 'omra', '${BOB}')`)).rows.length).toBe(0) // autre organisation : rien
  })

  it("les vues de performance gagnent organization_id EN DERNIER (les colonnes existantes gardent leur ordre)", async () => {
    await exec(M10)
    const cols = (name: string) => db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = '${name}' ORDER BY ordinal_position`).then((r) => r.rows.map((x) => x.column_name))
    expect((await cols("landing_campaign_performance")).slice(0, 8)).toEqual(["channel", "utm_campaign", "product", "leads", "leads_traites", "reservations", "taux_conversion_pct", "chiffre_affaires_tnd"])
    expect((await cols("landing_campaign_performance")).at(-1)).toBe("organization_id")
    expect((await cols("landing_niche_performance")).at(-1)).toBe("organization_id")
    expect((await cols("landing_niche_performance")).slice(0, 7)).toEqual(["product", "niche", "clics_whatsapp", "visiteurs_contact", "leads", "reservations", "chiffre_affaires_tnd"])
  })

  it("rôles : la fonction promo à 3 arguments n'est exécutable ni par anon ni par les comptes connectés", async () => {
    await exec(M10)
    for (const role of ["anon", "authenticated"]) {
      await exec(`SET ROLE ${role}`)
      await expect(db.query(`SELECT * FROM landing_redeem_promo('X', 'omra', '${E2B}')`)).rejects.toThrow(/permission denied/)
      await exec("RESET ROLE")
    }
  })
})

describe("0011 (resserrer) : deux entreprises coexistent sans conflit ni fuite d'existence", () => {
  beforeEach(async () => {
    await exec(M10)
    await exec(M11)
    await secondOrg()
  })

  it("guards : exige 0010, refuse une seconde exécution", async () => {
    const fresh = new PGlite()
    await fresh.exec(STUB + BEFORE)
    await expect(fresh.exec(M11)).rejects.toThrow(/0010/)
    await expect(exec(M11)).rejects.toThrow(/déjà/)
  })

  it("LEADS : même clé d'envoi et même téléphone + produit + jour dans deux entreprises = accepté ; dans la même entreprise = refusé ; la référence reste unique sur la plateforme", async () => {
    await lead(E2B, { idempotency_key: "evt-shared01", phone: "21698000111", ref: "E2B-AAAAAA" })
    await lead(BOB, { idempotency_key: "evt-shared01", phone: "21698000111", ref: "E2B-BBBBBB" }) // mêmes valeurs, autre entreprise : OK
    await expect(lead(E2B, { idempotency_key: "evt-shared01", phone: "21698000222", ref: "E2B-CCCCCC" })).rejects.toThrow(/duplicate key/)
    await expect(lead(E2B, { idempotency_key: "evt-other001", phone: "21698000111", ref: "E2B-DDDDDD" })).rejects.toThrow(/duplicate key/) // même téléphone + produit + jour
    await expect(lead(BOB, { idempotency_key: "evt-other002", phone: "21698000333", ref: "E2B-AAAAAA" })).rejects.toThrow(/landing_leads_ref_uq/) // référence : globale
  })

  it("ÉVÉNEMENTS, BLOCAGE, INTÉGRATIONS : mêmes valeurs dans deux entreprises acceptées, doublons refusés dans la même", async () => {
    for (const org of [E2B, BOB]) {
      await exec(`INSERT INTO landing_events (event_name, event_id, product, organization_id) VALUES ('Contact', 'ev-shared-01', 'omra', '${org}')`)
      await exec(`INSERT INTO landing_blocklist (kind, value, organization_id) VALUES ('phone', '21698000999', '${org}')`)
      await exec(`INSERT INTO landing_integrations (provider, organization_id) VALUES ('meta', '${org}')`)
    }
    await expect(exec(`INSERT INTO landing_events (event_name, event_id, product, organization_id) VALUES ('Contact', 'ev-shared-01', 'omra', '${BOB}')`)).rejects.toThrow(/duplicate key/)
    await expect(exec(`INSERT INTO landing_blocklist (kind, value, organization_id) VALUES ('phone', '21698000999', '${E2B}')`)).rejects.toThrow(/duplicate key/)
    await expect(exec(`INSERT INTO landing_integrations (provider, organization_id) VALUES ('meta', '${BOB}')`)).rejects.toThrow(/duplicate key/)
    await exec(`INSERT INTO landing_integrations (provider, organization_id) VALUES ('tiktok', '${BOB}')`) // autre fournisseur : OK
    // le comportement « insérer ou mettre à jour » du serveur (on_conflict = organisation + fournisseur) fonctionne par organisation
    await exec(`INSERT INTO landing_integrations (provider, organization_id, enabled) VALUES ('meta', '${BOB}', true) ON CONFLICT (organization_id, provider) DO UPDATE SET enabled = EXCLUDED.enabled`)
    expect((await db.query<{ enabled: boolean }>(`SELECT enabled FROM landing_integrations WHERE organization_id = '${BOB}' AND provider = 'meta'`)).rows[0].enabled).toBe(true)
    expect((await db.query<{ enabled: boolean }>(`SELECT enabled FROM landing_integrations WHERE organization_id = '${E2B}' AND provider = 'meta'`)).rows[0].enabled).toBe(false)
  })

  it("PROTECTION : une ligne par organisation (plus de ligne unique) ; CODES PROMO, CATÉGORIES, OFFRES : mêmes code / slug / SKU dans deux entreprises, doublons refusés dans la même", async () => {
    await exec(`INSERT INTO landing_protection (id, organization_id) VALUES (1, '${BOB}')`)
    expect((await db.query("SELECT 1 FROM landing_protection")).rows.length).toBe(2)
    await expect(exec(`INSERT INTO landing_protection (id, organization_id) VALUES (1, '${BOB}')`)).rejects.toThrow(/duplicate key/)
    for (const org of [E2B, BOB]) {
      await exec(`INSERT INTO landing_promo_codes (code, title, discount_type, discount_value, organization_id) VALUES ('RAMADAN27', 'Ramadan', 'percent', 10, '${org}')`)
      await exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('categorie-test', 'Catégorie test', 'omra', '${org}')`)
      await exec(`INSERT INTO landing_offers (product, name, sku, price, organization_id) VALUES ('omra', 'Offre', 'TEST-SKU-1', 5000, '${org}')`)
    }
    await expect(exec(`INSERT INTO landing_promo_codes (code, title, discount_type, discount_value, organization_id) VALUES ('RAMADAN27', 'xx', 'percent', 5, '${BOB}')`)).rejects.toThrow(/duplicate key/)
    await expect(exec(`INSERT INTO landing_categories (slug, name, product, organization_id) VALUES ('categorie-test', 'x y', 'omra', '${E2B}')`)).rejects.toThrow(/duplicate key/)
    await expect(exec(`INSERT INTO landing_offers (product, name, sku, price, organization_id) VALUES ('omra', 'Offre bis', 'TEST-SKU-1', 1, '${BOB}')`)).rejects.toThrow(/duplicate key/)
  })

  it("CODE PROMO : l'utilisation d'un code ne consomme QUE le code de SON entreprise ; l'ancienne fonction (sans organisation) n'existe plus", async () => {
    for (const org of [E2B, BOB]) await exec(`INSERT INTO landing_promo_codes (code, title, discount_type, discount_value, organization_id) VALUES ('RAMADAN27', 'Ramadan', 'percent', 10, '${org}')`)
    expect((await db.query(`SELECT * FROM landing_redeem_promo('ramadan27', 'omra', '${BOB}')`)).rows.length).toBe(1)
    const used = async (org: string) => (await db.query<{ used_count: number }>(`SELECT used_count FROM landing_promo_codes WHERE organization_id = '${org}'`)).rows[0].used_count
    expect([await used(E2B), await used(BOB)]).toEqual([0, 1])
    await expect(db.query("SELECT * FROM landing_redeem_promo('RAMADAN27', 'omra')")).rejects.toThrow(/does not exist|n'existe pas/)
    await exec(`UPDATE landing_promo_codes SET max_uses = 1 WHERE organization_id = '${BOB}'`)
    expect((await db.query(`SELECT * FROM landing_redeem_promo('RAMADAN27', 'omra', '${BOB}')`)).rows.length).toBe(0) // plafond de Bob atteint
    expect((await db.query(`SELECT * FROM landing_redeem_promo('RAMADAN27', 'omra', '${E2B}')`)).rows.length).toBe(1) // celui d'Easy2Book n'est pas touché
  })

  it("VALEUR PAR DÉFAUT supprimée : une insertion SANS organisation est refusée sur les 13 tables (jamais rattachée à Easy2Book par oubli)", async () => {
    await expect(lead(null)).rejects.toThrow(/organization_id/)
    for (const sql of [
      `INSERT INTO landing_events (event_name, event_id, product) VALUES ('Contact', 'ev-noorg-01', 'omra')`,
      `INSERT INTO landing_blocklist (kind, value) VALUES ('phone', '21698000777')`,
      `INSERT INTO landing_promo_codes (code, title, discount_type, discount_value) VALUES ('SANSORG', 'x y', 'percent', 5)`,
      `INSERT INTO landing_categories (slug, name, product) VALUES ('sans-org', 'Sans org', 'omra')`,
    ]) await expect(exec(sql), sql).rejects.toThrow(/organization_id/)
    const defaults = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND column_default IS NOT NULL AND table_name LIKE 'landing\\_%'")).rows[0].n
    expect(defaults).toBe(0)
  })

  it("VUES : une ligne par organisation, chacune ne comptant que SES leads", async () => {
    await lead(E2B, { product: "omra", niche: "n1" })
    await lead(E2B, { product: "omra", niche: "n1" })
    await lead(BOB, { product: "omra", niche: "n1" })
    const camp = (await db.query<{ organization_id: string; leads: number }>("SELECT organization_id, leads::int AS leads FROM landing_campaign_performance ORDER BY organization_id")).rows
    expect(camp).toEqual([{ organization_id: BOB, leads: 1 }, { organization_id: E2B, leads: 2 }])
    const niche = (await db.query<{ organization_id: string; leads: number }>("SELECT organization_id, leads::int AS leads FROM landing_niche_performance ORDER BY organization_id")).rows
    expect(niche).toEqual([{ organization_id: BOB, leads: 1 }, { organization_id: E2B, leads: 2 }])
  })

  it("RLS inchangée : un compte connecté ne lit toujours que son organisation (leads de A invisibles pour B)", async () => {
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000c1', 'a@x.tn'), ('00000000-0000-4000-8000-0000000000c2', 'b@x.tn')`)
    await db.exec(`INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${E2B}', '00000000-0000-4000-8000-0000000000c1', 'admin'), ('${BOB}', '00000000-0000-4000-8000-0000000000c2', 'employee')`)
    await lead(E2B)
    await lead(BOB)
    const asUser = async (sub: string) => {
      await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub}', false); SET ROLE authenticated`)
      try { return (await db.query<{ organization_id: string }>("SELECT organization_id FROM landing_leads")).rows } finally { await db.exec("RESET ROLE") }
    }
    expect(await asUser("00000000-0000-4000-8000-0000000000c1")).toEqual([{ organization_id: E2B }])
    expect(await asUser("00000000-0000-4000-8000-0000000000c2")).toEqual([{ organization_id: BOB }])
  })
})

describe("retours arrière et contrôles", () => {
  it("retour arrière 0011 : refusé tant que 0011 n'est pas appliquée, et refusé dès qu'il existe DEUX organisations (des unicités globales les feraient entrer en conflit)", async () => {
    await exec(M10)
    await expect(exec(R11)).rejects.toThrow(/0011 n'est pas appliquée/)
    await exec("ROLLBACK")
    await exec(M11)
    await secondOrg()
    await expect(exec(R11)).rejects.toThrow(/plusieurs organisations/)
  })

  it("retour arrière 0011 avec UNE organisation : rétablit unicités globales, ancienne fonction et valeurs par défaut ; le garde-fou revient ; rejouable", async () => {
    await exec(M10)
    await exec(M11)
    await exec(R11)
    expect((await db.query("SELECT 1 FROM pg_indexes WHERE indexname = 'landing_leads_idempotency_key_uq'")).rows.length).toBe(1)
    await lead(null) // valeur par défaut Easy2Book de retour
    expect((await db.query("SELECT * FROM landing_redeem_promo('X', 'omra')")).rows.length).toBe(0) // ancienne fonction de retour
    await expect(secondOrg()).rejects.toThrow(/0011/) // garde-fou ré-armé
    await exec(M11) // rejouable
  })

  it("retour arrière 0010 : refusé tant que 0011 est appliquée ; ensuite il remet exactement le schéma de 0009 (vues d'origine comprises)", async () => {
    await exec(M10)
    await exec(M11)
    await expect(exec(R10)).rejects.toThrow(/0011 est appliquée/)
    await exec("ROLLBACK")
    await exec(R11)
    await exec(R10)
    const idx = (await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.indexname)
    expect(idx.filter((i) => i.includes("_org_") && i.endsWith("_uq"))).toEqual([]) // plus aucune unicité par organisation (les index de 0008 restent)
    const cols = (await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'landing_campaign_performance'")).rows.map((r) => r.column_name)
    expect(cols).not.toContain("organization_id")
    expect((await db.query("SELECT proname FROM pg_proc WHERE proname = 'landing_redeem_promo'")).rows.length).toBe(1) // seulement l'ancienne
    await secondOrg() // plus de garde-fou : retour à l'état 0009
    await exec(M10).catch(() => {})
  })

  it("postcheck-0010 : OK après 0010 (puis ÉCHEC si une unicité par organisation manque) ; postcheck-0011 : OK après 0011 ; lecture seule", async () => {
    const run = async (sql: string) => ((await db.exec(sql)) as unknown as { rows: { statut: string }[] }[])[0].rows.map((r) => r.statut)
    expect((await run(POST10)).includes("ÉCHEC")).toBe(true) // 0009 seule
    await exec(M10)
    const ok10 = await run(POST10)
    expect(ok10.length).toBeGreaterThanOrEqual(6)
    expect(ok10.every((s) => s === "OK")).toBe(true)
    expect((await run(POST11)).includes("ÉCHEC")).toBe(true) // 0011 pas encore appliquée
    await exec(M11)
    const ok11 = await run(POST11)
    expect(ok11.length).toBeGreaterThanOrEqual(6)
    expect(ok11.every((s) => s === "OK")).toBe(true)
    await exec("DROP INDEX landing_leads_org_idempotency_uq")
    expect((await run(POST10)).includes("ÉCHEC")).toBe(true) // sabotage détecté
    for (const sql of [POST10, POST11]) expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s|GRANT\s|TRUNCATE)\b/i)
  })
})
