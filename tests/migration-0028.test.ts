import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0028 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) : journal des conversions Meta.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0028").sort()
const M28 = read("migrations/0028_conversion_log.sql"), R28 = read("rollback/0028_rollback.sql"), P28 = read("scripts/postcheck-0028.sql")
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
let chain = ""
beforeAll(() => { chain = CHAIN.filter((f) => f !== "0027_age_range.sql").map((f) => read(`migrations/${f}`)).join("\n") }) // 0027 volontairement absente : 0028 en est indépendante
const fresh = async () => { const db = new PGlite(); await db.exec(STUB + chain); await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`).catch(() => undefined); return db }
const ins = (id: string, o: { org?: string; name?: string; time?: number } = {}) => `INSERT INTO landing_conversion_log (organization_id, network, event_name, event_id, event_time) VALUES ('${o.org ?? E2B}', 'meta', '${o.name ?? "Purchase"}', '${id}', ${o.time ?? 1790000000})`
const fails = async (db: PGlite, sql: string, re: RegExp) => { await expect(db.exec(sql)).rejects.toThrow(re); await db.exec("ROLLBACK").catch(() => undefined) }

describe("0028 — journal des conversions Meta", () => {
  it("s'applique SANS la migration 0027 (indépendante) et crée un journal vide", async () => {
    const db = await fresh(); await db.exec(M28)
    const r = await db.query<{ n: number }>("SELECT count(*)::int n FROM landing_conversion_log")
    expect(r.rows[0].n).toBe(0)
  })

  it("unicité : le même évènement ne peut pas être journalisé deux fois dans une entreprise, mais peut l'être dans une autre", async () => {
    const db = await fresh(); await db.exec(M28)
    await db.exec(ins("purchase-aaaa1111")); await db.exec(ins("purchase-aaaa1111", { org: BOB }))
    await fails(db, ins("purchase-aaaa1111"), /event_uq|unique/i)
  })

  it("valeurs contrôlées : nom d'évènement, état, tentatives, identifiant, montant, longueur de l'erreur", async () => {
    const db = await fresh(); await db.exec(M28)
    await fails(db, ins("purchase-bbbb2222", { name: "CompleteRegistration" }), /event_name_check/)
    await fails(db, ins("court"), /event_id_check/)
    await fails(db, ins("purchase-cccc3333", { time: 0 }), /event_time_check/)
    await db.exec(ins("purchase-dddd4444"))
    await fails(db, `UPDATE landing_conversion_log SET status='envoyé'`, /status_check/)
    await fails(db, `UPDATE landing_conversion_log SET attempts=11`, /attempts_check/)
    await fails(db, `UPDATE landing_conversion_log SET value_tnd=-1`, /value_tnd_check/)
    await fails(db, `UPDATE landing_conversion_log SET last_error='${"x".repeat(201)}'`, /last_error_check/)
    await db.exec(`UPDATE landing_conversion_log SET status='failed', attempts=2, last_error='${"x".repeat(200)}', next_retry_at=now()`)
  })

  it("garde-fous : 0001 à 0026 requises, double exécution refusée, EasyV4 détectée", async () => {
    const db = await fresh(); await db.exec(M28)
    await fails(db, M28, /déjà été appliquée/)
    const early = new PGlite(); await early.exec(STUB + CHAIN.filter((f) => f < "0020").map((f) => read(`migrations/${f}`)).join("\n"))
    await fails(early, M28, /0001 à 0026/)
    const other = new PGlite(); await other.exec(STUB + chain + "CREATE TABLE public.agencies (id int);")
    await fails(other, M28, /EasyV4/)
  })

  it("droits : aucun accès pour anon / authenticated, le serveur peut lire, ajouter et changer l'état mais JAMAIS supprimer ; l'entreprise est immuable", async () => {
    const db = await fresh(); await db.exec(M28); await db.exec(ins("purchase-eeee5555"))
    await db.exec("SET ROLE service_role")
    await db.exec(`UPDATE landing_conversion_log SET status='sent'`)
    await expect(db.exec(`DELETE FROM landing_conversion_log`)).rejects.toThrow(/permission denied/i)
    await db.exec("RESET ROLE")
    await db.exec("SET ROLE anon"); await expect(db.exec("SELECT 1 FROM landing_conversion_log")).rejects.toThrow(/permission denied/i); await db.exec("RESET ROLE")
    await db.exec("SET ROLE authenticated"); await expect(db.exec("SELECT 1 FROM landing_conversion_log")).rejects.toThrow(/permission denied/i); await db.exec("RESET ROLE")
    await fails(db, `UPDATE landing_conversion_log SET organization_id='${BOB}'`, /immuable/i)
  })

  it("contrôle après application : 5 lignes OK", async () => {
    const db = await fresh(); await db.exec(M28)
    const r = await db.query<{ resultat: string }>(P28.replace(/^--.*$/gm, "").trim().replace(/;\s*$/, ""))
    expect(r.rows.map((x) => x.resultat)).toEqual(["OK", "OK", "OK", "OK", "OK"])
  })

  it("retour arrière : refusé si le journal contient des lignes, accepté sinon, migration rejouable", async () => {
    const db = await fresh(); await db.exec(M28); await db.exec(ins("purchase-ffff6666"))
    await fails(db, R28, /Exportez-les/)
    await db.exec("DELETE FROM landing_conversion_log"); await db.exec(R28)
    expect((await db.query("SELECT to_regclass('public.landing_conversion_log') AS t")).rows[0]).toEqual({ t: null })
    await db.exec(M28)
  })
})
