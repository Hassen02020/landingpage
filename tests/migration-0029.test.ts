import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0028 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) : journal des conversions Meta.
// 0001 → 0029 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) : conversations.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0029").sort()
const M29 = read("migrations/0029_conversations.sql"), R29 = read("rollback/0029_rollback.sql"), P29 = read("scripts/postcheck-0029.sql")
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
beforeAll(() => { chain = CHAIN.map((f) => read(`migrations/${f}`)).join("\n") })
const fresh = async () => { const db = new PGlite(); await db.exec(STUB + chain); await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`).catch(() => undefined); return db }
const lot = (o: { org?: string; n?: number; extra?: string } = {}) => `INSERT INTO landing_conversations (organization_id, kind, channel, conversation_count${o.extra ? ", " + o.extra.split("=")[0] : ""}) VALUES ('${o.org ?? E2B}','lot','whatsapp',${o.n ?? 12}${o.extra ? ", " + o.extra.split("=")[1] : ""})`
const indiv = (cols = "", vals = "") => `INSERT INTO landing_conversations (organization_id, kind, channel${cols}) VALUES ('${E2B}','individuelle','messenger'${vals})`
const fails = async (db: PGlite, sql: string, re: RegExp) => { await expect(db.exec(sql)).rejects.toThrow(re); await db.exec("ROLLBACK").catch(() => undefined) }

describe("0029 — conversations", () => {
  it("s'applique et crée une table vide, sans aucune colonne de téléphone, de nom ni de texte", async () => {
    const db = await fresh(); await db.exec(M29)
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM landing_conversations")).rows[0].n).toBe(0)
    const cols = (await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='landing_conversations'")).rows.map((r) => r.column_name)
    expect(cols.filter((c) => /phone|tel|mobile|name|email|text|body/i.test(c))).toEqual([])
    expect(cols).toEqual(expect.arrayContaining(["lead_id", "contact_ref", "created_by", "updated_by", "updated_at", "anonymized_at"]))
  })

  it("lot : n conversations sans identité ; un lot ne peut pas porter de fiche ni d'identifiant", async () => {
    const db = await fresh(); await db.exec(M29); await db.exec(lot({ n: 12 }))
    await fails(db, lot({ extra: "contact_ref='abc'" }), /lot_ck/)
    const lead = await db.query<{ id: string }>(`INSERT INTO landing_leads (organization_id, ref, idempotency_key, first_name, phone, product, contact_consent) VALUES ('${E2B}','E2B-CNV001','evt-cnv-0001','Test','21622000011','hotel',true) RETURNING id`)
    await fails(db, lot({ extra: `lead_id='${lead.rows[0].id}'` }), /lot_ck/)
    await db.exec(indiv(", lead_id", `, '${lead.rows[0].id}'`)) // une conversation individuelle peut être reliée à la fiche (qui porte le numéro)
    expect((await db.query<{ n: number }>("SELECT sum(conversation_count)::int n FROM landing_conversations")).rows[0].n).toBe(12 + 1)
  })

  it("individuelle : une seule conversation, reliée ou non à une fiche ; valeurs contrôlées", async () => {
    const db = await fresh(); await db.exec(M29); await db.exec(indiv())
    await fails(db, indiv(", conversation_count", ", 3"), /indiv_ck/)
    await fails(db, `INSERT INTO landing_conversations (organization_id, kind, channel) VALUES ('${E2B}','individuelle','sms')`, /channel_check/)
    await fails(db, `INSERT INTO landing_conversations (organization_id, kind, channel) VALUES ('${E2B}','groupe','whatsapp')`, /kind_check/)
    await fails(db, indiv(", origin", ", 'pub'"), /origin_check/)
    await fails(db, indiv(", status", ", 'supprimee'"), /status_check/)
    await fails(db, indiv(", messages_in", ", -1"), /messages_in_check/)
    await fails(db, indiv(", conversation_count", ", 0"), /conversation_count_check/)
    await fails(db, indiv(", started_at, last_activity_at", ", now(), now() - interval '1 day'"), /dates_ck/)
    await db.exec(`UPDATE landing_conversations SET status='annulee', updated_by='${BOB}', updated_at=now()`)
  })

  it("garde-fous : 0001 à 0026 requises, double exécution refusée, EasyV4 détectée", async () => {
    const db = await fresh(); await db.exec(M29)
    await fails(db, M29, /déjà été appliquée/)
    const early = new PGlite(); await early.exec(STUB + CHAIN.filter((f) => f < "0020").map((f) => read(`migrations/${f}`)).join("\n"))
    await fails(early, M29, /0001 à 0026/)
    const other = new PGlite(); await other.exec(STUB + chain + "CREATE TABLE public.agencies (id int);")
    await fails(other, M29, /EasyV4/)
  })

  it("droits : aucun accès pour anon / authenticated, le serveur lit, ajoute et modifie mais JAMAIS ne supprime ; l'entreprise est immuable", async () => {
    const db = await fresh(); await db.exec(M29); await db.exec(lot())
    await db.exec("SET ROLE service_role")
    await db.exec(`UPDATE landing_conversations SET status='annulee'`)
    await expect(db.exec(`DELETE FROM landing_conversations`)).rejects.toThrow(/permission denied/i)
    await db.exec("RESET ROLE")
    for (const role of ["anon", "authenticated"]) { await db.exec(`SET ROLE ${role}`); await expect(db.exec("SELECT 1 FROM landing_conversations")).rejects.toThrow(/permission denied/i); await db.exec("RESET ROLE") }
    await fails(db, `UPDATE landing_conversations SET organization_id='${BOB}'`, /immuable/i)
  })

  it("contrôle après application : 6 lignes OK", async () => {
    const db = await fresh(); await db.exec(M29)
    const r = await db.query<{ resultat: string }>(P29.replace(/^--.*$/gm, "").trim().replace(/;\s*$/, ""))
    expect(r.rows.map((x) => x.resultat)).toEqual(["OK", "OK", "OK", "OK", "OK", "OK"])
  })

  it("retour arrière : refusé si la table contient des lignes, accepté sinon, migration rejouable", async () => {
    const db = await fresh(); await db.exec(M29); await db.exec(lot())
    await fails(db, R29, /Exportez-les/)
    await db.exec("DELETE FROM landing_conversations"); await db.exec(R29)
    expect((await db.query("SELECT to_regclass('public.landing_conversations') AS t")).rows[0]).toEqual({ t: null })
    await db.exec(M29)
  })
})
