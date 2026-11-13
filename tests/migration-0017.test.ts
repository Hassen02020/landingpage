import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql", "0013_manager_role.sql", "0014_form_configs.sql", "0015_meta_lead_pages.sql", "0016_ad_economics.sql"].map(M).join("\n")
const M17 = M("0017_variable_costs.sql")
const R17 = read("rollback/0017_rollback.sql")
const POST17 = read("scripts/postcheck-0017.sql")
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
const exec = (s: string) => db.exec(s)
let n = 0
const newLead = async (org: string) => {
  n++
  await exec(`INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, organization_id) VALUES ('E2B-Q${String(n).padStart(5, "2")}','evt-${String(n).padStart(8, "0")}','A','2169900${String(n).padStart(4, "0")}','omra',true,'${org}')`)
  return (await db.query<{ id: string }>(`SELECT id FROM landing_leads WHERE organization_id='${org}' ORDER BY created_at DESC LIMIT 1`)).rows[0].id
}
const cost = (org: string, o: Record<string, string | number | null> = {}) => {
  const v: Record<string, string | number | null> = { organization_id: org, cost_date: "2026-11-05", category: "frais_paiement", amount_tnd: 20, ...o }
  const cols = Object.keys(v)
  const vals = cols.map((c) => (v[c] === null ? "NULL" : typeof v[c] === "number" ? String(v[c]) : `'${String(v[c]).replace(/'/g, "''")}'`))
  return exec(`INSERT INTO landing_variable_costs (${cols.join(",")}) VALUES (${vals.join(",")})`)
}
const fails = async (p: Promise<unknown>, re?: RegExp) => { await expect(p).rejects.toThrow(re); await exec("ROLLBACK").catch(() => undefined) }

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await exec(STUB + BEFORE)
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`)
})

describe("0017", () => {
  it("garde-fous : 0016 requise, EasyV4, double exécution", async () => {
    const early = new PGlite(); await early.exec(STUB + ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql"].map(M).join("\n"))
    await expect(early.exec(M17)).rejects.toThrow(/0016/)
    await exec(M17)
    await expect(exec(M17)).rejects.toThrow(/déjà/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M17)).rejects.toThrow(/EasyV4/)
  })

  it("postcheck : 4 OK après, À CORRIGER avant", async () => {
    expect((await db.query<{ resultat: string }>(POST17)).rows.some((r) => r.resultat === "À CORRIGER")).toBe(true)
    await exec(M17)
    const r = (await db.query<{ resultat: string }>(POST17)).rows
    expect(r).toHaveLength(4)
    expect(r.every((x) => x.resultat === "OK"), JSON.stringify(r)).toBe(true)
  })

  it("catégories : la publicité et le remboursement ne sont PAS des coûts variables", async () => {
    await exec(M17)
    await cost(E2B)
    await fails(cost(E2B, { category: "publicite" }))
    await fails(cost(E2B, { category: "remboursement" }))
    await fails(cost(E2B, { amount_tnd: 0 }))
    await fails(cost(E2B, { amount_tnd: -5 }))
  })

  it("anti double comptage : réservation OU campagne, jamais les deux ; réseau et campagne vont ensemble", async () => {
    await exec(M17)
    const l = await newLead(E2B)
    await cost(E2B, { lead_id: l })
    await cost(E2B, { network: "meta", campaign: "Omra 2027" })
    await cost(E2B)
    await fails(cost(E2B, { lead_id: l, network: "meta", campaign: "Omra 2027" }))
    await fails(cost(E2B, { network: "meta" }))
    await fails(cost(E2B, { campaign: "Omra" }))
    await fails(cost(E2B, { network: "google", campaign: "x" }))
  })

  it("isolation : une réservation d'une autre entreprise est refusée", async () => {
    await exec(M17)
    const b = await newLead(BOB)
    await fails(cost(E2B, { lead_id: b }), /autre entreprise/)
    await cost(BOB, { lead_id: b })
  })

  it("annulation : écriture exactement opposée (même rattachement), une seule fois ; ajout seul", async () => {
    await exec(M17)
    const l = await newLead(E2B)
    await cost(E2B, { lead_id: l, amount_tnd: 35.5 })
    const id = (await db.query<{ id: number }>("SELECT id FROM landing_variable_costs")).rows[0].id
    await fails(cost(E2B, { lead_id: l, amount_tnd: -10, voids_id: id }), /annulation invalide/)
    await fails(cost(E2B, { amount_tnd: -35.5, voids_id: id }), /annulation invalide/)
    await fails(cost(E2B, { lead_id: l, amount_tnd: -35.5, voids_id: id, category: "autre" }), /annulation invalide/)
    await cost(E2B, { lead_id: l, amount_tnd: -35.5, voids_id: id })
    await fails(cost(E2B, { lead_id: l, amount_tnd: -35.5, voids_id: id }))
    await exec("SET ROLE service_role")
    await expect(exec("UPDATE landing_variable_costs SET amount_tnd = 1")).rejects.toThrow(/permission/)
    await expect(exec("DELETE FROM landing_variable_costs")).rejects.toThrow(/permission/)
    await exec("RESET ROLE")
  })

  it("retour arrière : refusé avec des données, sinon propre", async () => {
    await exec(M17)
    await cost(E2B)
    await expect(exec(R17)).rejects.toThrow(/ARRÊT/)
    await exec("ROLLBACK").catch(() => undefined)
    await exec("DELETE FROM landing_variable_costs").catch(() => undefined)
    await exec("TRUNCATE landing_variable_costs")
    await exec(R17)
    expect((await db.query("SELECT to_regclass('public.landing_variable_costs') AS t")).rows[0]).toEqual({ t: null })
  })
})
