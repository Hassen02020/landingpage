import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0032 sur PostgreSQL (PGlite) : L7b — confirmation des réservations (Q2-A) et référence justificative de commission (Q3, option C).
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql"].map(M).join("\n")
const M8 = M("0008_multitenant_foundation.sql")
const M16 = M("0016_ad_economics.sql")
const M31 = M("0031_employee_own_leads_only.sql")
const M32 = M("0032_booking_confirmation.sql")
const ROLLBACK = read("rollback/0032_rollback.sql")
const POST = read("scripts/postcheck-0032.sql")
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

const ALICE = "00000000-0000-4000-8000-0000000000a0"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const U = (n: string) => `00000000-0000-4000-8000-0000000000${n}`
const [A_ADMIN, A_MGR, A_EMP1, A_EMP2, B_EMP] = [U("11"), U("12"), U("13"), U("14"), U("21")]

let db: PGlite
let n = 0
async function lead(org: string, assigned: string | null = null) {
  n++
  const row = { ref: `E2B-ZZ${String(n).padStart(4, "2")}`, idempotency_key: `evt-${String(n).padStart(8, "0")}`, first_name: "Test", phone: `2169900${String(n).padStart(4, "0")}`, product: "omra", contact_consent: true, organization_id: org, assigned_to: assigned }
  const k = Object.keys(row)
  return (await db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))).rows[0].id
}
async function asUser<T = any>(sub: string | null, sql: string): Promise<T[]> {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub ?? ""}', false); SET ROLE authenticated`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec("RESET ROLE")
  }
}
async function asService(sql: string, params: unknown[] = []) {
  await db.exec("SET ROLE service_role")
  try {
    return (await db.query<any>(sql, params)).rows
  } finally {
    await db.exec("RESET ROLE")
  }
}
const ids = (rows: { lead_id: string }[]) => rows.map((r) => r.lead_id).sort()
const confirm = (lead_id: string, org: string, extra = "") => asService(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, supplier_confirmed, supplier_confirmed_on${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('${org}', '${lead_id}', 'oui', CURRENT_DATE${extra ? ", " + extra.split("=").slice(1).join("=") : ""}) RETURNING id`)

let l1: string, l2: string, lFree: string, lB: string

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(BEFORE)
  await db.exec(M8)
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${U("22")}', 'bobadmin@x.tn')`)
  await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${ALICE}', 'alice', 'Alice SARL'), ('${BOB}', 'bob', 'Bob SARL')`)
  for (const [id, e] of [[A_ADMIN, "aa"], [A_MGR, "am"], [A_EMP1, "e1"], [A_EMP2, "e2"], [B_EMP, "be"]]) await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${e}@x.tn')`)
  await db.exec(`
    INSERT INTO landing_staff (user_id, email, role, organization_id) VALUES
      ('${A_EMP1}', 'e1@x.tn', 'agent', '${ALICE}'), ('${A_EMP2}', 'e2@x.tn', 'agent', '${ALICE}'), ('${B_EMP}', 'be@x.tn', 'agent', '${BOB}');
    INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${ALICE}', '${A_ADMIN}', 'admin'), ('${ALICE}', '${A_MGR}', 'manager'), ('${BOB}', '${U("22")}', 'admin');`)
  l1 = await lead(ALICE, A_EMP1)
  l2 = await lead(ALICE, A_EMP2)
  lFree = await lead(ALICE, null)
  lB = await lead(BOB, B_EMP)
  await db.exec(M16)
  await db.exec(M31)
  await db.exec(M32)
})

describe("migration 0032 : garde-fous", () => {
  it("exige 0008 et 0016, refuse une base EasyV4, refuse d'être rejouée", async () => {
    const early = new PGlite()
    await early.exec(STUB + BEFORE)
    await expect(early.exec(M32)).rejects.toThrow(/0008/)
    const no16 = new PGlite()
    await no16.exec(STUB + BEFORE + M8)
    await expect(no16.exec(M32)).rejects.toThrow(/0016/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + M8 + M16 + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M32)).rejects.toThrow(/EasyV4/)
    await expect(db.exec(M32)).rejects.toThrow(/déjà été appliquée/)
  })
  it("aucune confirmation créée, aucune offre « définie », aucune ligne existante modifiée", async () => {
    expect((await db.query("SELECT 1 FROM landing_booking_confirmations")).rows).toEqual([])
    expect((await db.query("SELECT 1 FROM landing_offers WHERE payment_terms_defined OR deposit_kind IS NOT NULL")).rows).toEqual([])
  })
})

describe("confirmations : droits de lecture et d'écriture", () => {
  it("un employé ne lit que la confirmation de SES dossiers, jamais celle d'un collègue ni d'une autre organisation", async () => {
    await confirm(l1, ALICE); await confirm(l2, ALICE); await confirm(lFree, ALICE); await confirm(lB, BOB)
    expect(ids(await asUser(A_EMP1, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual([l1])
    expect(ids(await asUser(A_EMP2, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual([l2])
    expect(await asUser(A_EMP1, `SELECT 1 FROM landing_booking_confirmations WHERE lead_id IN ('${l2}', '${lFree}', '${lB}')`)).toEqual([])
    expect(ids(await asUser(B_EMP, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual([lB])
  })
  it("administrateur et manager lisent toute leur organisation, jamais l'autre", async () => {
    await confirm(l1, ALICE); await confirm(l2, ALICE); await confirm(lFree, ALICE); await confirm(lB, BOB)
    const all = [l1, l2, lFree].sort()
    expect(ids(await asUser(A_ADMIN, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual(all)
    expect(ids(await asUser(A_MGR, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual(all)
    expect(await asUser(A_MGR, `SELECT 1 FROM landing_booking_confirmations WHERE lead_id = '${lB}'`)).toEqual([])
    expect(await asUser(null, "SELECT 1 FROM landing_booking_confirmations")).toEqual([])
  })
  it("une réaffectation déplace la lecture du dossier vers le nouvel employé", async () => {
    await confirm(l1, ALICE)
    await db.exec(`UPDATE landing_leads SET assigned_to = '${A_EMP2}' WHERE id = '${l1}'`)
    expect(await asUser(A_EMP1, "SELECT 1 FROM landing_booking_confirmations")).toEqual([])
    expect(ids(await asUser(A_EMP2, "SELECT lead_id FROM landing_booking_confirmations"))).toEqual([l1])
  })
  it("aucune écriture par jeton (employé, manager, administrateur, anonyme) ; jamais de suppression, même par le serveur", async () => {
    await confirm(l1, ALICE)
    for (const who of [A_EMP1, A_MGR, A_ADMIN]) {
      await expect(asUser(who, `INSERT INTO landing_booking_confirmations (organization_id, lead_id) VALUES ('${ALICE}', '${l2}')`)).rejects.toThrow(/permission denied/)
      await expect(asUser(who, "UPDATE landing_booking_confirmations SET supplier_confirmed = 'non'")).rejects.toThrow(/permission denied/)
      await expect(asUser(who, "DELETE FROM landing_booking_confirmations")).rejects.toThrow(/permission denied/)
    }
    await expect(asService("DELETE FROM landing_booking_confirmations")).rejects.toThrow(/permission denied/)
  })
})

describe("confirmations : intégrité", () => {
  it("un seul enregistrement par dossier", async () => {
    await confirm(l1, ALICE)
    await expect(confirm(l1, ALICE)).rejects.toThrow(/unique|duplicate/i)
  })
  it("l'entreprise doit être celle du dossier et ne peut jamais changer ; le dossier ne change jamais", async () => {
    await expect(confirm(l1, BOB)).rejects.toThrow(/autre entreprise/)
    await confirm(l1, ALICE)
    await expect(db.exec(`UPDATE landing_booking_confirmations SET organization_id = '${BOB}'`)).rejects.toThrow()
    await expect(db.exec(`UPDATE landing_booking_confirmations SET lead_id = '${l2}'`)).rejects.toThrow(/change pas de dossier/)
  })
  it("date exigée si « oui », jamais dans le futur", async () => {
    await expect(db.exec(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, supplier_confirmed) VALUES ('${ALICE}', '${l1}', 'oui')`)).rejects.toThrow()
    await expect(db.exec(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, payment_respected) VALUES ('${ALICE}', '${l1}', 'oui')`)).rejects.toThrow()
    await expect(db.exec(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, supplier_confirmed, supplier_confirmed_on) VALUES ('${ALICE}', '${l1}', 'oui', CURRENT_DATE + 30)`)).rejects.toThrow(/futur/)
    await db.exec(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, supplier_confirmed) VALUES ('${ALICE}', '${l1}', 'non')`) // « non » sans date : permis
  })
  it("mention : 140 caractères au plus, ni e-mail, ni lien, ni téléphone", async () => {
    const ok = "e-mail du fournisseur du 24/11"
    await confirm(l1, ALICE, `supplier_proof_note='${ok}'`)
    for (const [i, bad] of Array.from(["x".repeat(141), "écrire à a@b.tn", "voir https://exemple.tn/x", "www.exemple.tn", "appeler le 21612345678", "tel +216 12 345 678"].entries())) {
      const target = [l2, lFree][i % 2]
      await expect(db.query(`INSERT INTO landing_booking_confirmations (organization_id, lead_id, supplier_confirmed, supplier_confirmed_on, supplier_proof_note) VALUES ('${ALICE}', '${target}', 'oui', CURRENT_DATE, $1)`, [bad])).rejects.toThrow()
    }
  })
})

describe("conditions de paiement par offre", () => {
  const offer = (cols: string, vals: string) => db.exec(`INSERT INTO landing_offers (product, name, price, organization_id${cols}) VALUES ('omra', 'Offre test', 100, '${ALICE}'${vals})`)
  it("facultatives : une offre sans conditions reste valide et non définie", async () => {
    await offer("", "")
    expect((await db.query<any>("SELECT payment_terms_defined AS d, deposit_kind AS k FROM landing_offers")).rows[0]).toEqual({ d: false, k: null })
  })
  it("pourcentage ≤ 100, valeur absente si « aucun », valeur obligatoire sinon, « définies » exige un type d'acompte", async () => {
    await offer(", deposit_kind, deposit_value, payment_terms_defined", ", 'pourcentage', 30, true")
    await expect(offer(", deposit_kind, deposit_value", ", 'pourcentage', 120")).rejects.toThrow()
    await expect(offer(", deposit_kind, deposit_value", ", 'aucun', 10")).rejects.toThrow()
    await expect(offer(", deposit_kind", ", 'montant'")).rejects.toThrow()
    await expect(offer(", payment_terms_defined", ", true")).rejects.toThrow()
    await offer(", deposit_kind, payment_terms_defined", ", 'aucun', true")
  })
  it("mention ≤ 140 caractères sans téléphone, e-mail ni lien", async () => {
    await offer(", payment_terms_note", ", 'Solde 15 jours avant le départ'")
    await expect(offer(", payment_terms_note", `, '${"x".repeat(141)}'`)).rejects.toThrow()
    await expect(offer(", payment_terms_note", ", 'contact a@b.tn'")).rejects.toThrow()
    await expect(offer(", payment_terms_note", ", 'https://x.tn'")).rejects.toThrow()
    await expect(offer(", payment_terms_note", ", 'appeler 21612345678'")).rejects.toThrow()
  })
})

describe("référence justificative de commission (option C)", () => {
  let c1: number
  beforeEach(async () => {
    const r = await db.query<{ id: number }>(`INSERT INTO landing_commissions (organization_id, lead_id, line_key, external_ref, kind, amount_tnd, event_date) VALUES ('${ALICE}', '${l1}', 'RES-1|commission|1', 'RES-1', 'commission', 50, CURRENT_DATE) RETURNING id`)
    c1 = r.rows[0].id
  })
  const confirmSql = (id: number, ref: string | null) => asService("UPDATE landing_commissions SET status = 'confirme', confirmed_at = now(), confirmed_by = $2, confirmation_ref = $3 WHERE id = $1", [id, A_ADMIN, ref])
  it("la référence est facultative : la confirmation sans référence fonctionne toujours", async () => {
    await confirmSql(c1, null)
    expect((await db.query<any>("SELECT status, confirmation_ref FROM landing_commissions")).rows[0]).toEqual({ status: "confirme", confirmation_ref: null })
  })
  it("la référence se pose à la transition provisoire → confirmé", async () => {
    await confirmSql(c1, "virement du 25/11, pièce 4412")
    expect((await db.query<any>("SELECT confirmation_ref AS r FROM landing_commissions")).rows[0].r).toBe("virement du 25/11, pièce 4412")
  })
  it("jamais à l'insertion, jamais après la confirmation, jamais pour modifier une autre colonne ; l'historique n'est pas réécrit", async () => {
    await expect(db.exec(`INSERT INTO landing_commissions (organization_id, lead_id, line_key, external_ref, kind, amount_tnd, event_date, confirmation_ref) VALUES ('${ALICE}', '${l1}', 'RES-2|commission|1', 'RES-2', 'commission', 10, CURRENT_DATE, 'x')`)).rejects.toThrow(/confirmation/)
    await expect(asService("UPDATE landing_commissions SET confirmation_ref = 'x' WHERE id = $1", [c1])).rejects.toThrow()
    await confirmSql(c1, null)
    await expect(asService("UPDATE landing_commissions SET confirmation_ref = 'tardif' WHERE id = $1", [c1])).rejects.toThrow(/seule la confirmation/)
    await expect(asService("UPDATE landing_commissions SET amount_tnd = 99 WHERE id = $1", [c1])).rejects.toThrow()
  })
  it("la référence est contrôlée (140 caractères, ni e-mail, ni lien, ni téléphone)", async () => {
    for (const bad of ["x".repeat(141), "a@b.tn", "http://x.tn", "21612345678"]) await expect(confirmSql(c1, bad)).rejects.toThrow()
    expect((await db.query<any>("SELECT status FROM landing_commissions")).rows[0].status).toBe("provisoire")
  })
  it("aucune ligne existante n'a de référence ; aucun jeton ne peut écrire", async () => {
    expect((await db.query("SELECT 1 FROM landing_commissions WHERE confirmation_ref IS NOT NULL")).rows).toEqual([])
    await expect(asUser(A_ADMIN, "UPDATE landing_commissions SET confirmation_ref = 'x'")).rejects.toThrow(/permission denied/)
  })
})

describe("historique du dossier", () => {
  it("accepte le type « confirmation de réservation modifiée » et garde les types précédents", async () => {
    await db.exec(`INSERT INTO landing_lead_activities (lead_id, actor_label, type, body) VALUES ('${l1}', 'a@x.tn', 'booking_confirmation_changed', 'Fournisseur : oui')`)
    await db.exec(`INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ('${l1}', 'a@x.tn', 'wa_in')`)
    await expect(db.exec(`INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ('${l1}', 'a@x.tn', 'inconnu')`)).rejects.toThrow()
  })
})

describe("retour arrière et contrôle", () => {
  it("postcheck-0032 : 6 contrôles OK après 0032, en ÉCHEC avant, en lecture seule", async () => {
    const run = async (d: PGlite) => ((await d.exec(POST)) as unknown as { rows: { statut: string }[] }[])[0].rows.map((r) => r.statut)
    expect(await run(db)).toEqual(Array(6).fill("OK"))
    const before = new PGlite()
    await before.exec(STUB + BEFORE + M8 + M16 + M31)
    const b = await run(before).catch(() => ["ÉCHEC"])
    expect(b.includes("ÉCHEC")).toBe(true)
    expect(POST.replace(/--.*$/gm, "")).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s|GRANT\s|TRUNCATE)\b/i)
  })
  it("retour arrière : refusé si des données existent ; sinon remet l'état précédent (garde de commission comprise) et reste rejouable", async () => {
    await confirm(l1, ALICE)
    await expect(db.exec(ROLLBACK)).rejects.toThrow(/données L7b/)
    await db.exec("ROLLBACK")
    // sans données : on repart d'une base neuve
    const fresh = new PGlite()
    await fresh.exec(STUB + BEFORE + M8 + M16 + M31 + M32)
    await fresh.exec(ROLLBACK)
    expect((await fresh.query("SELECT to_regclass('public.landing_booking_confirmations') AS t")).rows[0]).toEqual({ t: null })
    expect((await fresh.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'landing_commissions' AND column_name = 'confirmation_ref'")).rows).toEqual([])
    await fresh.exec(M32) // rejouable après retour arrière
  })
})
