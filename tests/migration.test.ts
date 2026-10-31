import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// Migration exécutée sur un vrai moteur PostgreSQL (PGlite, en mémoire), rôles Supabase recréés.
const MIGRATION = readFileSync(new URL("../supabase/migrations/0001_landing_leads.sql", import.meta.url), "utf8")
const ROLES = "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;"

const lead = (o: Record<string, unknown> = {}) => ({
  ref: "E2B-ABC234",
  idempotency_key: "evt-00000001",
  first_name: "Ahmed",
  phone: "21698140514",
  product: "omra",
  contact_consent: true,
  ...o,
})

async function insert(db: PGlite, row: Record<string, unknown>) {
  const keys = Object.keys(row)
  return db.query(
    `INSERT INTO landing_leads (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
    Object.values(row)
  )
}

let db: PGlite
beforeEach(async () => {
  db = new PGlite()
  await db.exec(ROLES)
})

describe("migration 0001_landing_leads.sql", () => {
  it("s'applique sur un projet vierge", async () => {
    await db.exec(MIGRATION)
    const t = await db.query<{ n: string }>("SELECT string_agg(table_name, ',' ORDER BY table_name) AS n FROM information_schema.tables WHERE table_schema='public'")
    expect(t.rows[0].n).toBe("landing_campaign_performance,landing_events,landing_leads,landing_niche_performance")
  })

  it("refuse de s'exécuter sur une base EasyV4 (CRM)", async () => {
    await db.exec("CREATE TABLE public.agencies (id int)")
    await expect(db.exec(MIGRATION)).rejects.toThrow(/EasyV4/)
    expect((await db.query("SELECT to_regclass('public.landing_leads') AS t")).rows[0]).toEqual({ t: null })
  })

  it("refuse une seconde exécution", async () => {
    await db.exec(MIGRATION)
    await expect(db.exec(MIGRATION)).rejects.toThrow(/déjà/)
  })

  describe("contraintes", () => {
    beforeEach(async () => {
      await db.exec(MIGRATION)
    })

    it("accepte un lead valide et calcule lead_day (heure de Tunis)", async () => {
      const r = await insert(db, lead())
      expect(r.rows[0]).toMatchObject({ status: "nouveau", marketing_consent: false, tracking_consent: false })
      expect((r.rows[0] as any).lead_day).toBeInstanceOf(Date)
    })

    it.each([
      ["sans accord de recontact", { contact_consent: false }],
      ["référence mal formée", { ref: "XYZ" }],
      ["téléphone non normalisé", { phone: "+216 98" }],
      ["produit inconnu", { product: "croisiere" }],
      ["statut inconnu", { status: "gagne" }],
      ["réservé sans date de réservation", { status: "reserve" }],
      ["montant négatif", { booking_value: -5 }],
      ["adultes hors limites", { adults: 0 }],
      ["identifiant publicitaire sans consentement", { fbclid: "FB1" }],
      ["IP sans consentement", { ip: "1.2.3.4" }],
    ])("refuse : %s", async (_label, o) => {
      await expect(insert(db, lead(o))).rejects.toThrow()
    })

    it("accepte les identifiants publicitaires avec consentement", async () => {
      await expect(insert(db, lead({ tracking_consent: true, fbclid: "FB1", ip: "1.2.3.4" }))).resolves.toBeTruthy()
    })

    it("anti-doublon : même idempotency_key", async () => {
      await insert(db, lead())
      await expect(insert(db, lead({ phone: "21622123456" }))).rejects.toThrow(/duplicate key/)
    })

    it("anti-doublon : même téléphone + même produit le même jour ; autre produit accepté", async () => {
      await insert(db, lead())
      await expect(insert(db, lead({ idempotency_key: "evt-00000002" }))).rejects.toThrow(/landing_leads_phone_product_day_uq/)
      await expect(insert(db, lead({ idempotency_key: "evt-00000003", product: "hotel" }))).resolves.toBeTruthy()
    })

    it("landing_events : événement hors liste refusé, event_id unique", async () => {
      await db.query("INSERT INTO landing_events (event_name, event_id) VALUES ('Contact', 'evt-00000001')")
      await expect(db.query("INSERT INTO landing_events (event_name, event_id) VALUES ('Contact', 'evt-00000001')")).rejects.toThrow()
      await expect(db.query("INSERT INTO landing_events (event_name, event_id) VALUES ('Lead', 'evt-00000002')")).rejects.toThrow()
    })
  })

  describe("droits d'accès", () => {
    beforeEach(async () => {
      await db.exec(MIGRATION)
      await insert(db, lead())
    })

    it.each(["anon", "authenticated"])("%s ne peut ni lire ni écrire", async (role) => {
      await db.exec(`SET ROLE ${role}`)
      await expect(db.query("SELECT * FROM landing_leads")).rejects.toThrow(/permission denied/)
      await expect(db.query("SELECT * FROM landing_events")).rejects.toThrow(/permission denied/)
      await expect(db.query("SELECT * FROM landing_campaign_performance")).rejects.toThrow(/permission denied/)
      await expect(insert(db, lead({ idempotency_key: "evt-00000009", phone: "21622000000" }))).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE")
    })

    it("service_role peut lire, écrire et mettre à jour, mais pas supprimer", async () => {
      await db.exec("SET ROLE service_role")
      expect((await db.query("SELECT count(*)::int AS n FROM landing_leads")).rows[0]).toEqual({ n: 1 })
      await insert(db, lead({ idempotency_key: "evt-00000010", phone: "21622000000" }))
      await db.query("UPDATE landing_leads SET status = 'contacte'")
      expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_campaign_performance")).rows[0].n).toBeGreaterThan(0)
      await expect(db.query("DELETE FROM landing_leads")).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE")
    })

    it("RLS activée et forcée, sans aucune politique", async () => {
      const r = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('landing_leads','landing_events') ORDER BY relname"
      )
      expect(r.rows).toEqual([
        { relname: "landing_events", relrowsecurity: true, relforcerowsecurity: true },
        { relname: "landing_leads", relrowsecurity: true, relforcerowsecurity: true },
      ])
      expect((await db.query("SELECT count(*)::int AS n FROM pg_policies")).rows[0]).toEqual({ n: 0 })
    })
  })
})
