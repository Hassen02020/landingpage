import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0025 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) :
// avis des visiteurs : garde-fous, contraintes, droits limités au statut, isolation, retour arrière.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0025").sort()
const M25 = read("migrations/0025_reviews.sql")
const R25 = read("rollback/0025_rollback.sql")
const P25 = read("scripts/postcheck-0025.sql")
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
const H = (n: number) => String(n).padStart(64, "0")
let db: PGlite
const exec = (s: string) => db.exec(s)
const fails = async (p: Promise<unknown>, re?: RegExp) => { await expect(p).rejects.toThrow(re); await exec("ROLLBACK").catch(() => undefined) }
const post = async (sql: string) => (await db.query<{ resultat: string }>(sql)).rows.map((r) => r.resultat)
const ins = (extra = "", cols = "", vals = "") => exec(`INSERT INTO landing_reviews (organization_id, page_key, rating, first_name, publish_consent, content_hash${cols}) VALUES ('${E2B}','omra',5,'Amine',true,'${H(1)}'${vals})`.replace("'" + H(1) + "'", `'${extra || H(1)}'`))

beforeAll(async () => {
  db = new PGlite()
  await exec(STUB)
  for (const f of CHAIN) await exec(read(`migrations/${f}`))
  await exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`).catch(() => undefined)
}, 120_000)

describe("0025 — avis des visiteurs", () => {
  it("postcheck : À CORRIGER avant, 5 OK après ; garde-fous (double exécution, EasyV4, 0008 requise)", async () => {
    expect((await post(P25)).includes("À CORRIGER")).toBe(true)
    await exec(M25)
    const r = await post(P25)
    expect(r).toHaveLength(5)
    expect(r.every((x) => x === "OK"), JSON.stringify(r)).toBe(true)
    await fails(exec(M25), /déjà/)
    const other = new PGlite(); await other.exec(STUB + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M25)).rejects.toThrow(/EasyV4/)
    const early = new PGlite(); await early.exec(STUB)
    await expect(early.exec(M25)).rejects.toThrow(/0008/)
  })
  it("un avis arrive TOUJOURS « en attente », sans date de modération", async () => {
    await ins(H(1))
    expect((await db.query("SELECT status, moderated_at FROM landing_reviews")).rows[0]).toEqual({ status: "pending", moderated_at: null })
  })
  it("contraintes : note 1 à 5, prénom 2 à 60, commentaire ≤ 600, langue, page, accord de publication OBLIGATOIRE", async () => {
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',6,'Amine',true,'${H(2)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',0,'Amine',true,'${H(3)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'A',true,'${H(4)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'${"x".repeat(61)}',true,'${H(5)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,comment,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'Amine','${"y".repeat(601)}',true,'${H(6)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'Amine',false,'${H(7)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,lang,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'Amine','xx',true,'${H(8)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','Pas Valide',5,'Amine',true,'${H(10)}')`), /check/i)
    await fails(exec(`INSERT INTO landing_reviews (organization_id,page_key,rating,first_name,publish_consent,content_hash) VALUES ('${E2B}','omra',5,'Amine',true,'trop-court')`), /check/i)
  })
  it("un même contenu n'est accepté qu'une fois par page et par entreprise ; une autre entreprise peut avoir le sien", async () => {
    await fails(ins(H(1)), /unique|duplicate/i)
    await exec(`INSERT INTO landing_reviews (organization_id, page_key, rating, first_name, publish_consent, content_hash) VALUES ('${BOB}','omra',4,'Bob',true,'${H(1)}')`)
  })
  it("modération : « publié » exige une date, « en attente » n'en a pas ; l'entreprise d'un avis est immuable", async () => {
    await fails(exec(`UPDATE landing_reviews SET status='published' WHERE organization_id='${E2B}'`), /check/i)
    await exec(`UPDATE landing_reviews SET status='published', moderated_at=now() WHERE organization_id='${E2B}'`)
    await fails(exec(`UPDATE landing_reviews SET organization_id='${BOB}' WHERE organization_id='${E2B}'`), /immuable/i)
  })
  it("droits : le serveur lit, ajoute et change le STATUT seulement (ni la note, ni le texte, ni suppression) ; ni anon ni comptes connectés", async () => {
    await exec("SET ROLE service_role")
    expect((await db.query("SELECT count(*)::int AS n FROM landing_reviews")).rows[0]).toMatchObject({ n: 2 })
    await exec("UPDATE landing_reviews SET status='rejected', moderated_at=now() WHERE organization_id='" + E2B + "'")
    await fails(exec("UPDATE landing_reviews SET rating = 1"), /permission/i)
    await exec("SET ROLE service_role")
    await fails(exec("UPDATE landing_reviews SET comment = 'modifié'"), /permission/i)
    await exec("SET ROLE service_role")
    await fails(exec("UPDATE landing_reviews SET first_name = 'Autre'"), /permission/i)
    await exec("SET ROLE service_role")
    await fails(exec("DELETE FROM landing_reviews"), /permission/i)
    await exec("RESET ROLE")
    for (const role of ["anon", "authenticated"]) {
      await exec(`SET ROLE ${role}`)
      await fails(db.query("SELECT 1 FROM landing_reviews"), /permission/i)
      await exec("RESET ROLE")
    }
  })
  it("retour arrière : refusé tant qu'il existe des avis ; accepté une fois vide ; réapplicable", async () => {
    await fails(exec(R25), /avis existent/)
    await exec("DELETE FROM landing_reviews")
    await exec(R25)
    expect((await post(P25)).includes("À CORRIGER")).toBe(true)
    await exec(M25)
    expect((await post(P25)).every((x) => x === "OK")).toBe(true)
  })
})
