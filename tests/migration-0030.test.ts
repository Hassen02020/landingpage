import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0030 sur PostgreSQL de test (ces essais ne prouvent rien sur la base de production) : signalement des doublons de dossiers.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const CHAIN = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql") && f < "0030").sort()
const M30 = read("migrations/0030_duplicate_reviews.sql"), R30 = read("rollback/0030_rollback.sql"), P30 = read("scripts/postcheck-0030.sql")
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
const U1 = "00000000-0000-4000-8000-0000000000a1" // conseiller qui signale
const U2 = "00000000-0000-4000-8000-0000000000a2" // responsable qui décide
let chain = "", n = 0
beforeAll(() => { chain = CHAIN.map((f) => read(`migrations/${f}`)).join("\n") })
const fresh = async () => { const db = new PGlite(); await db.exec(STUB + chain); await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${BOB}','bob','Bob SARL')`).catch(() => undefined); return db }
const lead = async (db: PGlite, o: { org?: string; phone?: string; product?: string } = {}): Promise<string> => {
  const i = ++n
  const r = await db.query<{ id: string }>(`INSERT INTO landing_leads (organization_id, ref, idempotency_key, first_name, phone, product, contact_consent) VALUES ('${o.org ?? E2B}','E2B-D${String(i).padStart(5, "0")}','evt-dup-${i}-aaaa','Test','${o.phone ?? "21622000001"}','${o.product ?? "hotel"}',true) RETURNING id`)
  return r.rows[0].id
}
const pair = async (db: PGlite, phone = "21622000001") => ({ cand: await lead(db, { phone, product: "omra" }), prim: await lead(db, { phone, product: "hotel" }) })
const flag = (cand: string, prim: string, o: { rule?: string; by?: string; org?: string } = {}) =>
  `INSERT INTO landing_duplicate_reviews (organization_id, lead_id, primary_lead_id, rule, confidence, reported_by) VALUES ('${o.org ?? E2B}','${cand}','${prim}','${o.rule ?? "technique_15min"}','elevee','${o.by ?? U1}')`
const decide = (id: number, status: string, by = U2) => `UPDATE landing_duplicate_reviews SET status='${status}', decided_by='${by}', decided_at=now() WHERE id=${id}`
const fails = async (db: PGlite, sql: string, re: RegExp) => { await expect(db.exec(sql)).rejects.toThrow(re); await db.exec("ROLLBACK").catch(() => undefined) }
const reviewId = async (db: PGlite) => (await db.query<{ id: number }>("SELECT id FROM landing_duplicate_reviews ORDER BY id DESC LIMIT 1")).rows[0].id

describe("0030 — doublons de dossiers", () => {
  it("s'applique sans modifier les dossiers existants et crée une table vide", async () => {
    const db = await fresh(); const id = await lead(db)
    const before = (await db.query<{ status: string; phone: string }>("SELECT status, phone FROM landing_leads WHERE id = $1", [id])).rows[0]
    await db.exec(M30)
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM landing_duplicate_reviews")).rows[0].n).toBe(0)
    expect((await db.query("SELECT status, phone, duplicate_of, duplicate_confirmed_at FROM landing_leads WHERE id = $1", [id])).rows[0]).toEqual({ ...before, duplicate_of: null, duplicate_confirmed_at: null })
  })

  it("cycle complet : signalé → confirmé pose duplicate_of ATOMIQUEMENT ; le STATUT du dossier ne change pas ; la réouverture l'efface", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await db.exec(`UPDATE landing_leads SET status='contacte' WHERE id='${cand}'`)
    await db.exec(flag(cand, prim)); const id = await reviewId(db)
    expect((await db.query<{ duplicate_of: string | null }>("SELECT duplicate_of FROM landing_leads WHERE id = $1", [cand])).rows[0].duplicate_of).toBeNull() // signalé ≠ confirmé
    await db.exec(decide(id, "confirme"))
    const c = (await db.query<{ duplicate_of: string; duplicate_confirmed_at: string | null; status: string }>("SELECT duplicate_of, duplicate_confirmed_at, status FROM landing_leads WHERE id = $1", [cand])).rows[0]
    expect(c.duplicate_of).toBe(prim); expect(c.duplicate_confirmed_at).not.toBeNull(); expect(c.status).toBe("contacte") // jamais « perdu »
    await db.exec(`UPDATE landing_duplicate_reviews SET status='signale', decided_by=NULL, decided_at=NULL WHERE id=${id}`) // réouverture
    expect((await db.query<{ duplicate_of: string | null }>("SELECT duplicate_of FROM landing_leads WHERE id = $1", [cand])).rows[0].duplicate_of).toBeNull()
  })

  it("rejet : le dossier reste compté (aucun duplicate_of) ; un nouveau signalement redevient possible après un rejet", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await db.exec(flag(cand, prim)); const id = await reviewId(db)
    await fails(db, flag(cand, prim), /active_uq|unique/i) // un seul signalement actif par dossier
    await db.exec(decide(id, "rejete"))
    expect((await db.query<{ duplicate_of: string | null }>("SELECT duplicate_of FROM landing_leads WHERE id = $1", [cand])).rows[0].duplicate_of).toBeNull()
    await db.exec(flag(cand, prim, { rule: "commerciale_30j" })) // permis : le précédent est « rejete »
  })

  it("D1 — double regard IMPOSÉ PAR LA BASE : on ne décide pas son propre signalement", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await db.exec(flag(cand, prim, { by: U1 })); const id = await reviewId(db)
    await fails(db, decide(id, "confirme", U1), /four_eyes/)
    await fails(db, decide(id, "rejete", U1), /four_eyes/)
    await db.exec(decide(id, "confirme", U2))
  })

  it("règles d'intégrité : statut, règle, confiance, longueurs, décision cohérente, deux dossiers distincts", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await fails(db, flag(cand, prim, { rule: "autre" }), /rule_check/)
    await fails(db, `INSERT INTO landing_duplicate_reviews (organization_id, lead_id, primary_lead_id, rule, confidence, reported_by) VALUES ('${E2B}','${cand}','${prim}','manuel','moyenne','${U1}')`, /confidence_check/)
    await fails(db, `INSERT INTO landing_duplicate_reviews (organization_id, lead_id, primary_lead_id, rule, confidence, reported_by, reason) VALUES ('${E2B}','${cand}','${prim}','manuel','elevee','${U1}','${"x".repeat(201)}')`, /reason_check/)
    await fails(db, flag(cand, cand), /distinct_ck|introuvable|même téléphone|principal/i)
    await fails(db, `INSERT INTO landing_duplicate_reviews (organization_id, lead_id, primary_lead_id, rule, confidence, reported_by, status) VALUES ('${E2B}','${cand}','${prim}','manuel','elevee','${U1}','confirme')`, /naît toujours|decision_ck/)
    await db.exec(flag(cand, prim)); const id = await reviewId(db)
    await fails(db, `UPDATE landing_duplicate_reviews SET status='confirme' WHERE id=${id}`, /decision_ck/) // décision sans auteur ni date
    await fails(db, `UPDATE landing_duplicate_reviews SET purchase_state='annule' WHERE id=${id}`, /purchase_state_check/)
    await db.exec(`UPDATE landing_duplicate_reviews SET purchase_state='retenu' WHERE id=${id}`)
  })

  it("cloisonnement et cohérence : autre entreprise, téléphone différent ou absent, chaînes refusés", async () => {
    const db = await fresh(); await db.exec(M30)
    const a = await lead(db, { phone: "21622000001", product: "omra" }), b = await lead(db, { phone: "21622000001", product: "hotel" })
    const other = await lead(db, { org: BOB, phone: "21622000001", product: "omra" }), diffPhone = await lead(db, { phone: "21622000002", product: "omra" })
    await fails(db, flag(a, other), /même entreprise/)
    await fails(db, flag(a, diffPhone), /même téléphone/)
    await fails(db, flag(a, b, { org: BOB }), /même entreprise/)
    await db.exec(flag(a, b)); const id = await reviewId(db); await db.exec(decide(id, "confirme")) // a est doublon confirmé de b
    const c = await lead(db, { phone: "21622000001", product: "voyage" }).catch(() => lead(db, { phone: "21622000001", product: "autre" }))
    await fails(db, flag(c, a), /doublon confirmé/) // le principal ne peut pas être un doublon
    await fails(db, flag(a, c), /déjà un doublon confirmé/) // le candidat est déjà confirmé
    await fails(db, `UPDATE landing_leads SET duplicate_of='${c}' WHERE id='${b}'`, /chaîne|principal/i) // b est principal de a : ne peut devenir doublon
  })

  it("garde sur les dossiers : duplicate_of seul est cohérent (pas soi-même, couple de colonnes, autre entreprise)", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await fails(db, `UPDATE landing_leads SET duplicate_of=id, duplicate_confirmed_at=now() WHERE id='${cand}'`, /self_ck/)
    await fails(db, `UPDATE landing_leads SET duplicate_of='${prim}' WHERE id='${cand}'`, /pair_ck/)
    const other = await lead(db, { org: BOB, phone: "21622000001", product: "omra" })
    await fails(db, `UPDATE landing_leads SET duplicate_of='${other}', duplicate_confirmed_at=now() WHERE id='${cand}'`, /autre entreprise/)
  })

  it("identité figée et transitions : aucune modification des dossiers, de la règle ou de l'auteur ; pas de confirmé ↔ rejeté direct", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await db.exec(flag(cand, prim)); const id = await reviewId(db)
    await fails(db, `UPDATE landing_duplicate_reviews SET rule='manuel' WHERE id=${id}`, /identité/)
    await fails(db, `UPDATE landing_duplicate_reviews SET reported_by='${U2}' WHERE id=${id}`, /identité/)
    await fails(db, `UPDATE landing_duplicate_reviews SET lead_id='${prim}', primary_lead_id='${cand}' WHERE id=${id}`, /identité/)
    await db.exec(decide(id, "confirme"))
    await fails(db, decide(id, "rejete"), /transition confirme → rejete interdite/)
  })

  it("types d'activité : les 4 nouveaux sont acceptés, un type inconnu et les types historiques fonctionnent comme avant", async () => {
    const db = await fresh(); await db.exec(M30); const id = await lead(db)
    const act = (t: string) => `INSERT INTO landing_lead_activities (lead_id, organization_id, actor_label, type) VALUES ('${id}','${E2B}','test','${t}')`
    for (const t of ["note", "status_change", "duplicate_flagged", "duplicate_confirmed", "duplicate_rejected", "duplicate_reopened"]) await db.exec(act(t))
    await fails(db, act("duplicate_deleted"), /type_check/)
  })

  it("droits : aucun accès anon / authenticated, le serveur lit, ajoute et modifie mais JAMAIS ne supprime ; l'entreprise est immuable", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db); await db.exec(flag(cand, prim)); const id = await reviewId(db)
    await db.exec("SET ROLE service_role")
    await db.exec(`UPDATE landing_duplicate_reviews SET reason='motif' WHERE id=${id}`)
    await expect(db.exec("DELETE FROM landing_duplicate_reviews")).rejects.toThrow(/permission denied/i)
    await db.exec("RESET ROLE")
    for (const role of ["anon", "authenticated"]) { await db.exec(`SET ROLE ${role}`); await expect(db.exec("SELECT 1 FROM landing_duplicate_reviews")).rejects.toThrow(/permission denied/i); await db.exec("RESET ROLE") }
    await fails(db, `UPDATE landing_duplicate_reviews SET organization_id='${BOB}' WHERE id=${id}`, /immuable/i)
  })

  it("garde-fous : 0001 à 0029 requises, double exécution refusée, EasyV4 détectée", async () => {
    const db = await fresh(); await db.exec(M30)
    await fails(db, M30, /déjà été appliquée/)
    const early = new PGlite(); await early.exec(STUB + CHAIN.filter((f) => f < "0020").map((f) => read(`migrations/${f}`)).join("\n"))
    await fails(early, M30, /0001 à 0029/)
    const other = new PGlite(); await other.exec(STUB + chain + "CREATE TABLE public.agencies (id int);")
    await fails(other, M30, /EasyV4/)
  })

  it("contrôle après application : 10 lignes OK", async () => {
    const db = await fresh(); await db.exec(M30)
    const r = await db.query<{ resultat: string }>(P30.replace(/^--.*$/gm, "").trim().replace(/;\s*$/, ""))
    expect(r.rows).toHaveLength(10); expect(r.rows.map((x) => x.resultat)).toEqual(Array(10).fill("OK"))
  })

  it("retour arrière : refusé avec des signalements, des doublons confirmés ou des activités de doublon ; accepté à vide ; migration rejouable ; contrainte d'activité restaurée", async () => {
    const db = await fresh(); await db.exec(M30); const { cand, prim } = await pair(db)
    await db.exec(flag(cand, prim)); const id = await reviewId(db)
    await fails(db, R30, /contient des signalements/)
    await db.exec(decide(id, "confirme"))
    await fails(db, R30, /signalements|confirmés comme doublons/) // la table est non vide : refus en premier
    const db2 = await fresh(); await db2.exec(M30); const x = await lead(db2)
    await db2.exec(`INSERT INTO landing_lead_activities (lead_id, organization_id, actor_label, type) VALUES ('${x}','${E2B}','test','duplicate_flagged')`)
    await fails(db2, R30, /activités de doublon/)
    const db3 = await fresh(); await db3.exec(M30); await db3.exec(R30)
    expect((await db3.query("SELECT to_regclass('public.landing_duplicate_reviews') AS t")).rows[0]).toEqual({ t: null })
    expect((await db3.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='landing_leads' AND column_name LIKE 'duplicate%'")).rows[0]).toEqual({ n: 0 })
    const y = await lead(db3)
    await expect(db3.exec(`INSERT INTO landing_lead_activities (lead_id, organization_id, actor_label, type) VALUES ('${y}','${E2B}','test','duplicate_flagged')`)).rejects.toThrow(/type_check/)
    await db3.exec("ROLLBACK").catch(() => undefined)
    await db3.exec(M30) // rejouable
  })
})
