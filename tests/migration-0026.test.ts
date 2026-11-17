import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0026 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) :
// gouvernance des données : garde-fous, valeurs contrôlées, lignes existantes intactes, trigger de garde, retour arrière.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0026").sort()
const M26 = read("migrations/0026_data_governance.sql")
const R26 = read("rollback/0026_rollback.sql")
const P26 = read("scripts/postcheck-0026.sql")
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
let chain = ""
beforeAll(() => { chain = CHAIN.map((f) => read(`migrations/${f}`)).join("\n") })

async function fresh(): Promise<PGlite> {
  const db = new PGlite(); await db.exec(STUB + chain); return db
}
const lead = (ref: string) => `INSERT INTO landing_leads (ref, first_name, phone, product, organization_id, idempotency_key, contact_consent, consent_text_version) VALUES ('${ref}', 'Test', '21698140514', 'omra', '${E2B}', 'idem-${ref}', true, 'v1')`
const fails = async (db: PGlite, sql: string, re: RegExp) => { await expect(db.exec(sql)).rejects.toThrow(re); await db.exec("ROLLBACK").catch(() => undefined) }

describe("0026 — gouvernance des données", () => {
  it("les leads existants restent intacts : is_test faux, motif et produit acheté vides", async () => {
    const db = await fresh()
    await db.exec(lead("E2B-AAAAA2")); await db.exec(lead("E2B-AAAAA3").replace("21698140514", "21698140515"))
    await db.exec(M26)
    const r = await db.query<{ n: number; t: number; l: number; p: number }>("SELECT count(*)::int n, count(*) FILTER (WHERE is_test)::int t, count(lost_reason)::int l, count(purchased_product)::int p FROM landing_leads")
    expect(r.rows[0]).toEqual({ n: 2, t: 0, l: 0, p: 0 })
  })

  it("valeurs contrôlées : motif de perte et produit acheté hors liste refusés, valeurs valides et NULL acceptés", async () => {
    const db = await fresh(); await db.exec(M26); await db.exec(lead("E2B-BBBBB2"))
    await db.exec(`UPDATE landing_leads SET lost_reason='prix', purchased_product='hotel', is_test=true`)
    await db.exec(`UPDATE landing_leads SET lost_reason=NULL, purchased_product=NULL`)
    await fails(db, `UPDATE landing_leads SET lost_reason='parce que'`, /lost_reason_check/)
    await fails(db, `UPDATE landing_leads SET purchased_product='croisiere'`, /purchased_product_check/)
    await fails(db, `UPDATE landing_leads SET is_test=NULL`, /null value|not-null/i)
  })

  it("le trigger de garde des leads ne bloque pas ces colonnes, mais protège toujours la date de réservation", async () => {
    const db = await fresh(); await db.exec(M26); await db.exec(lead("E2B-CCCCC2"))
    await db.exec(`UPDATE landing_leads SET is_test=true, lost_reason='concurrence'`)
    await db.exec(`UPDATE landing_leads SET status='reserve', booked_at=now(), booking_value=100, purchased_product='omra'`)
    await fails(db, `UPDATE landing_leads SET booked_at=now() + interval '1 day'`, /date de réservation/)
  })

  it("garde-fous : 0001 à 0025 requises, double exécution refusée, EasyV4 détectée", async () => {
    const db = await fresh(); await db.exec(M26)
    await fails(db, M26, /déjà été appliquée/)
    const early = new PGlite(); await early.exec(STUB + CHAIN.filter((f) => f < "0020").map((f) => read(`migrations/${f}`)).join("\n"))
    await fails(early, M26, /0001 à 0025/)
    const other = new PGlite(); await other.exec(STUB + chain + "CREATE TABLE public.agencies (id int);")
    await fails(other, M26, /EasyV4/)
  })

  it("contrôle après application : 4 lignes OK", async () => {
    const db = await fresh(); await db.exec(M26)
    const r = await db.query<{ resultat: string }>(P26.replace(/^--.*$/gm, "").trim().replace(/;\s*$/, ""))
    expect(r.rows).toHaveLength(4)
    expect(r.rows.map((x) => x.resultat)).toEqual(["OK", "OK", "OK", "OK"])
  })

  it("retour arrière : refusé si des données existent, accepté sinon, et la migration peut être rejouée", async () => {
    const db = await fresh(); await db.exec(M26); await db.exec(lead("E2B-DDDDD2"))
    await db.exec(`UPDATE landing_leads SET is_test=true`)
    await fails(db, R26, /Exportez-les/)
    await db.exec(`UPDATE landing_leads SET is_test=false`)
    await db.exec(R26)
    const cols = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='landing_leads' AND column_name IN ('is_test','lost_reason','purchased_product')")
    expect(cols.rows).toHaveLength(0)
    await db.exec(M26)
  })
})
