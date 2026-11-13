import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0016 sur PostgreSQL (PGlite) : configuration du formulaire par entreprise + champs personnalisés.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql"].map(M).join("\n")
const M14 = M("0014_form_configs.sql")
const M15 = M("0015_meta_lead_pages.sql")
const M16 = M("0016_ad_economics.sql")
const R16 = read("rollback/0016_rollback.sql")
const POST16 = read("scripts/postcheck-0016.sql")
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

describe("0016", () => {
  beforeEach(async () => { await exec(M14); await exec(M15) })
  const spend = (org: string, over: Record<string, string | number | null> = {}) => {
    const v: Record<string, string | number | null> = { organization_id: org, spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: 100, voids_id: null, ...over }
    const cols = Object.keys(v)
    const vals = cols.map((c) => (v[c] === null ? "NULL" : typeof v[c] === "number" ? String(v[c]) : `'${String(v[c]).replace(/'/g, "''")}'`))
    return exec(`INSERT INTO landing_ad_spend (${cols.join(",")}) VALUES (${vals.join(",")})`)
  }
  const commission = (org: string, leadId: string, over: Record<string, string | number> = {}) => {
    const v: Record<string, string | number> = { organization_id: org, lead_id: leadId, line_key: "RES-1|commission|1", external_ref: "RES-1", kind: "commission", amount_tnd: 300, event_date: "2026-11-06", ...over }
    const cols = Object.keys(v)
    const vals = cols.map((c) => (typeof v[c] === "number" ? String(v[c]) : `'${v[c]}'`))
    return exec(`INSERT INTO landing_commissions (${cols.join(",")}) VALUES (${vals.join(",")})`)
  }
  const leadId = async (org: string) => {
    await lead(org)
    return (await db.query<{ id: string }>(`SELECT id FROM landing_leads WHERE organization_id = '${org}' ORDER BY created_at DESC LIMIT 1`)).rows[0].id
  }
  const fails = async (p: Promise<unknown>, re?: RegExp) => {
    await expect(p).rejects.toThrow(re)
    await exec("ROLLBACK").catch(() => undefined)
  }

  it("garde-fous : EasyV4, 0008 requise, double exécution refusée", async () => {
    await exec(M16)
    await expect(exec(M16)).rejects.toThrow(/déjà/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M16)).rejects.toThrow(/0008/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M16)).rejects.toThrow(/EasyV4/)
  })

  it("postcheck : 6 OK après, À CORRIGER avant", async () => {
    expect((await db.query<{ resultat: string }>(POST16)).rows.some((r) => r.resultat === "À CORRIGER")).toBe(true)
    await exec(M16)
    const r = (await db.query<{ resultat: string }>(POST16)).rows
    expect(r).toHaveLength(6)
    expect(r.every((x) => x.resultat === "OK"), JSON.stringify(r)).toBe(true)
  })

  it("dépenses : montant positif, réseau meta ou tiktok, nom de campagne normalisé automatiquement", async () => {
    await exec(M16)
    await spend(E2B, { campaign: "  Omra   2027 " })
    expect((await db.query<{ k: string }>("SELECT campaign_key AS k FROM landing_ad_spend")).rows[0].k).toBe("omra 2027")
    await fails(spend(E2B, { amount_tnd: 0 }))
    await fails(spend(E2B, { amount_tnd: -5 }))
    await fails(spend(E2B, { network: "google" }))
    await fails(spend(E2B, { campaign: "   " }))
    await fails(spend(E2B, { spend_date: "2019-12-31" }))
  })

  it("annulation d'une dépense : montant exactement opposé, même campagne et même date, une seule fois", async () => {
    await exec(M16)
    await spend(E2B, { amount_tnd: 250.5 })
    const id = (await db.query<{ id: number }>("SELECT id FROM landing_ad_spend")).rows[0].id
    await fails(spend(E2B, { amount_tnd: -100, voids_id: id }), /annulation invalide/)
    await fails(spend(E2B, { amount_tnd: -250.5, voids_id: id, campaign: "Autre" }), /annulation invalide/)
    await fails(spend(E2B, { amount_tnd: -250.5, voids_id: id, spend_date: "2026-11-06" }), /annulation invalide/)
    await fails(spend(BOB, { amount_tnd: -250.5, voids_id: id }), /annulation invalide/)
    await fails(spend(E2B, { amount_tnd: 250.5, voids_id: id }))
    await spend(E2B, { amount_tnd: -250.5, voids_id: id, campaign: "OMRA 2027" })
    await fails(spend(E2B, { amount_tnd: -250.5, voids_id: id }))
    const sum = (await db.query<{ s: string }>("SELECT sum(amount_tnd)::text AS s FROM landing_ad_spend")).rows[0].s
    expect(Number(sum)).toBe(0)
    const voidId = (await db.query<{ id: number }>("SELECT id FROM landing_ad_spend WHERE voids_id IS NOT NULL")).rows[0].id
    await fails(spend(E2B, { amount_tnd: 250.5, voids_id: voidId }))
  })

  it("ajout seul : le serveur ne peut ni modifier ni supprimer une dépense", async () => {
    await exec(M16)
    await spend(E2B)
    await exec("SET ROLE service_role")
    await expect(exec("UPDATE landing_ad_spend SET amount_tnd = 1")).rejects.toThrow(/permission/)
    await expect(exec("DELETE FROM landing_ad_spend")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })

  it("commission : positive, annulation et remboursement négatifs ; le lead doit appartenir à la même entreprise", async () => {
    await exec(M16)
    const l = await leadId(E2B)
    await commission(E2B, l)
    await commission(E2B, l, { line_key: "RES-1|annulation|1", kind: "annulation", amount_tnd: -300 })
    await commission(E2B, l, { line_key: "RES-1|remboursement|1", kind: "remboursement", amount_tnd: -50 })
    await fails(commission(E2B, l, { line_key: "RES-2|commission|1", amount_tnd: -10 }))
    await fails(commission(E2B, l, { line_key: "RES-2|annulation|1", kind: "annulation", amount_tnd: 10 }))
    await fails(commission(E2B, l, { line_key: "RES-2|commission|1", kind: "inconnu" }))
    await fails(commission(BOB, l, { line_key: "RES-3|commission|1" }), /autre entreprise/)
  })

  it("idempotence : une même ligne importée deux fois est refusée (clé unique par entreprise)", async () => {
    await exec(M16)
    const l = await leadId(E2B)
    const b = await leadId(BOB)
    await commission(E2B, l)
    await fails(commission(E2B, l))
    await commission(BOB, b) // la même clé est libre dans une autre entreprise
  })

  it("provisoire par défaut ; confirmation possible UNE fois ; aucune autre modification", async () => {
    await exec(M16)
    const l = await leadId(E2B)
    await commission(E2B, l)
    expect((await db.query<{ s: string }>("SELECT status AS s FROM landing_commissions")).rows[0].s).toBe("provisoire")
    await exec("SET ROLE service_role")
    await expect(exec("UPDATE landing_commissions SET amount_tnd = 999")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
    await exec("SET ROLE service_role")
    await expect(exec("DELETE FROM landing_commissions")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
    await exec(`UPDATE landing_commissions SET status = 'confirme', confirmed_at = now()`)
    expect((await db.query<{ s: string }>("SELECT status AS s FROM landing_commissions")).rows[0].s).toBe("confirme")
    await fails(exec(`UPDATE landing_commissions SET status = 'provisoire', confirmed_at = NULL`), /confirmation/)
    await fails(exec(`UPDATE landing_commissions SET confirmed_at = now()`), /confirmation/)
    await fails(exec(`UPDATE landing_commissions SET amount_tnd = 1`), /confirmation/)
  })

  it("la confirmation ne peut pas être accompagnée d'un changement du montant (garde du déclencheur)", async () => {
    await exec(M16)
    const l = await leadId(E2B)
    await commission(E2B, l)
    await fails(exec(`UPDATE landing_commissions SET status = 'confirme', confirmed_at = now(), amount_tnd = 999`), /ne se modifie pas/)
    await fails(exec(`UPDATE landing_commissions SET status = 'confirme'`)) // confirmed_at obligatoire
  })

  it("aucun accès pour un compte d'utilisateur ni pour anon (données financières côté serveur)", async () => {
    await exec(M16)
    const l = await leadId(E2B)
    await spend(E2B); await commission(E2B, l)
    await asUser(U_E2B)
    await expect(exec("SELECT 1 FROM landing_ad_spend")).rejects.toThrow(/permission/)
    await expect(exec("SELECT 1 FROM landing_commissions")).rejects.toThrow(/permission/)
    await exec("RESET ROLE; SET ROLE anon")
    await expect(exec("SELECT 1 FROM landing_commissions")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })

  it("retour arrière : refusé s'il existe des données financières ; sinon propre", async () => {
    await exec(M16)
    await spend(E2B)
    await expect(exec(R16)).rejects.toThrow(/Exportez/)
    await exec("ROLLBACK").catch(() => undefined)
    // le propriétaire a exporté puis vidé les tables (super-utilisateur : le serveur n'a aucun droit de suppression)
    await exec("DELETE FROM landing_ad_spend")
    await exec(R16)
    expect(await db.query("SELECT to_regclass('public.landing_ad_spend') AS t").then((r) => (r.rows[0] as { t: unknown }).t)).toBeNull()
    expect(await db.query("SELECT to_regclass('public.landing_commissions') AS t").then((r) => (r.rows[0] as { t: unknown }).t)).toBeNull()
  })
})
