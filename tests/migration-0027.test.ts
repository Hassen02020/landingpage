import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0027 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) : tranche d'âge déclarée.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0027").sort()
const M27 = read("migrations/0027_age_range.sql"), R27 = read("rollback/0027_rollback.sql"), P27 = read("scripts/postcheck-0027.sql")
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
const fresh = async () => { const db = new PGlite(); await db.exec(STUB + chain); return db }
const lead = (ref: string, phone = "21698140514") => `INSERT INTO landing_leads (ref, first_name, phone, product, organization_id, idempotency_key, contact_consent, consent_text_version) VALUES ('${ref}', 'Test', '${phone}', 'omra', '${E2B}', 'idem-${ref}', true, 'v1')`
const fails = async (db: PGlite, sql: string, re: RegExp) => { await expect(db.exec(sql)).rejects.toThrow(re); await db.exec("ROLLBACK").catch(() => undefined) }

describe("0027 — tranche d'âge déclarée", () => {
  it("les leads existants restent intacts : age_range vide", async () => {
    const db = await fresh(); await db.exec(lead("E2B-AAAAA2")); await db.exec(M27)
    const r = await db.query<{ n: number; a: number }>("SELECT count(*)::int n, count(age_range)::int a FROM landing_leads")
    expect(r.rows[0]).toEqual({ n: 1, a: 0 })
  })
  it("valeurs contrôlées : les 5 tranches et NULL acceptés, toute autre valeur refusée", async () => {
    const db = await fresh(); await db.exec(M27); await db.exec(lead("E2B-BBBBB2"))
    for (const v of ["18-24", "25-34", "35-44", "45-54", "55+"]) await db.exec(`UPDATE landing_leads SET age_range='${v}'`)
    await db.exec(`UPDATE landing_leads SET age_range=NULL`)
    for (const v of ["12-17", "30", "jeune", "", "55 +"]) await fails(db, `UPDATE landing_leads SET age_range='${v}'`, /age_range_check/)
  })
  it("garde-fous : 0026 requise, double exécution refusée, EasyV4 détectée", async () => {
    const db = await fresh(); await db.exec(M27)
    await fails(db, M27, /déjà été appliquée/)
    const early = new PGlite(); await early.exec(STUB + CHAIN.filter((f) => f < "0020").map((f) => read(`migrations/${f}`)).join("\n"))
    await fails(early, M27, /0001 à 0026/)
    const other = new PGlite(); await other.exec(STUB + chain + "CREATE TABLE public.agencies (id int);")
    await fails(other, M27, /EasyV4/)
  })
  it("contrôle après application : 3 lignes OK", async () => {
    const db = await fresh(); await db.exec(M27)
    const r = await db.query<{ resultat: string }>(P27.replace(/^--.*$/gm, "").trim().replace(/;\s*$/, ""))
    expect(r.rows.map((x) => x.resultat)).toEqual(["OK", "OK", "OK"])
  })
  it("retour arrière : refusé si une tranche d'âge existe, accepté sinon, migration rejouable", async () => {
    const db = await fresh(); await db.exec(M27); await db.exec(lead("E2B-CCCCC2"))
    await db.exec(`UPDATE landing_leads SET age_range='25-34'`)
    await fails(db, R27, /Exportez-les/)
    await db.exec(`UPDATE landing_leads SET age_range=NULL`); await db.exec(R27)
    const c = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='landing_leads' AND column_name='age_range'")
    expect(c.rows).toHaveLength(0)
    await db.exec(M27)
  })
})
