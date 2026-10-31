import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 + 0002 exécutées sur PostgreSQL (PGlite), avec rôles et schéma auth simulés comme sur Supabase.
const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const M1 = read("0001_landing_leads.sql")
const M2 = read("0002_landing_crm.sql")
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;`

const STAFF = "11111111-1111-1111-1111-111111111111"
const OTHER = "22222222-2222-2222-2222-222222222222"

let db: PGlite
async function as(role: "authenticated" | "anon" | "service_role", uid: string | null, fn: () => Promise<unknown>) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false); SET ROLE ${role};`)
  try {
    return await fn()
  } finally {
    await db.exec("RESET ROLE")
  }
}
async function addLead(o: Record<string, unknown> = {}) {
  const row = { ref: "E2B-ABC234", idempotency_key: "evt-00000001", first_name: "Ahmed", phone: "21698140514", product: "omra", contact_consent: true, ...o }
  const k = Object.keys(row)
  const r = await db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))
  return r.rows[0].id
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
})

describe("migration 0002_landing_crm.sql", () => {
  it("exige 0001 et refuse une seconde exécution", async () => {
    await expect(db.exec(M2)).rejects.toThrow(/0001/)
    await db.exec(M1)
    await db.exec(M2)
    await expect(db.exec(M2)).rejects.toThrow(/déjà/)
  })

  it("refuse une base EasyV4", async () => {
    await db.exec(M1)
    await db.exec("CREATE TABLE public.agencies (id int)")
    await expect(db.exec(M2)).rejects.toThrow(/EasyV4/)
  })

  describe("après application", () => {
    let leadId: string
    beforeEach(async () => {
      await db.exec(M1)
      await db.exec(M2)
      await db.exec(`INSERT INTO auth.users VALUES ('${STAFF}'), ('${OTHER}');
        INSERT INTO landing_staff (user_id, email, role) VALUES ('${STAFF}', 'agent@easy2book.tn', 'agent');`)
      leadId = await addLead()
    })

    it("un compte connecté hors équipe ne voit aucun lead ; un membre actif les voit", async () => {
      expect(await as("authenticated", OTHER, async () => (await db.query("SELECT id FROM landing_leads")).rows.length)).toBe(0)
      expect(await as("authenticated", STAFF, async () => (await db.query("SELECT id FROM landing_leads")).rows.length)).toBe(1)
      await db.exec(`UPDATE landing_staff SET active = false WHERE user_id = '${STAFF}'`)
      expect(await as("authenticated", STAFF, async () => (await db.query("SELECT id FROM landing_leads")).rows.length)).toBe(0)
    })

    it("un compte hors équipe ne peut pas modifier un lead", async () => {
      await as("authenticated", OTHER, () => db.query(`UPDATE landing_leads SET status = 'perdu' WHERE id = '${leadId}'`))
      expect((await db.query<{ status: string }>("SELECT status FROM landing_leads")).rows[0].status).toBe("nouveau")
    })

    it("anon reste sans aucun droit", async () => {
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_leads"))).rejects.toThrow(/permission denied/)
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_lead_activities"))).rejects.toThrow(/permission denied/)
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_staff"))).rejects.toThrow(/permission denied/)
    })

    it("historique : un membre n'écrit qu'en son nom ; aucune modification ni suppression", async () => {
      await as("authenticated", STAFF, () =>
        db.query(`INSERT INTO landing_lead_activities (lead_id, actor_id, actor_label, type, body) VALUES ('${leadId}', '${STAFF}', 'agent', 'note', 'Appel')`)
      )
      await expect(
        as("authenticated", STAFF, () =>
          db.query(`INSERT INTO landing_lead_activities (lead_id, actor_id, actor_label, type) VALUES ('${leadId}', '${OTHER}', 'usurpation', 'note')`)
        )
      ).rejects.toThrow()
      await expect(db.query("UPDATE landing_lead_activities SET body = 'modifié'")).rejects.toThrow(/ajout seul/)
      await expect(db.query("DELETE FROM landing_lead_activities")).rejects.toThrow(/ajout seul/)
    })

    it("droit à l'effacement : supprimer un lead supprime son historique", async () => {
      await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ('${leadId}', 'système', 'created')`)
      await db.query(`DELETE FROM landing_leads WHERE id = '${leadId}'`)
      expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_lead_activities")).rows[0].n).toBe(0)
    })

    it("updated_at est mis à jour automatiquement", async () => {
      const before = (await db.query<{ updated_at: Date }>("SELECT updated_at FROM landing_leads")).rows[0].updated_at
      await new Promise((r) => setTimeout(r, 20))
      await db.query("UPDATE landing_leads SET status = 'contacte'")
      const after = (await db.query<{ updated_at: Date }>("SELECT updated_at FROM landing_leads")).rows[0].updated_at
      expect(after.getTime()).toBeGreaterThan(before.getTime())
    })

    it("contraintes : téléphone effaçable seulement si anonymisé ; retrait marketing cohérent", async () => {
      await expect(db.query("UPDATE landing_leads SET phone = NULL")).rejects.toThrow(/phone_unless_anonymized/)
      await expect(db.query("UPDATE landing_leads SET marketing_consent = true, marketing_withdrawn_at = now()")).rejects.toThrow(/withdrawn/)
      await expect(db.query("UPDATE landing_leads SET source = 'facebook'")).rejects.toThrow()
    })

    it("purge : identifiants après 90 jours, événements après 13 mois, anonymisation après 24 / 36 mois", async () => {
      await db.exec(`
        UPDATE landing_leads SET created_at = now() - interval '100 days', tracking_consent = true, ip = '1.2.3.4', fbclid = 'FB' WHERE id = '${leadId}';
        INSERT INTO landing_events (event_name, event_id, created_at) VALUES ('Contact', 'evt-old-00001', now() - interval '14 months'), ('Contact', 'evt-new-00001', now());`)
      const oldLost = await addLead({ ref: "E2B-OLD234", idempotency_key: "evt-00000002", phone: "21622000001", status: "perdu" })
      const oldBooked = await addLead({ ref: "E2B-RES234", idempotency_key: "evt-00000003", phone: "21622000002", status: "reserve", booked_at: new Date().toISOString(), booking_value: 4800 })
      await db.exec(`
        UPDATE landing_leads SET created_at = now() - interval '25 months' WHERE id IN ('${oldLost}', '${oldBooked}');`)

      const r = await as("service_role", null, () => db.query<{ r: Record<string, number> }>("SELECT public.landing_purge_personal_data() AS r"))
      expect((r as { rows: { r: Record<string, number> }[] }).rows[0].r).toEqual({ identifiants_effaces: 1, evenements_supprimes: 1, leads_anonymises: 1 })

      const rows = (await db.query<{ ref: string; ip: string | null; phone: string | null; first_name: string; anonymized_at: Date | null }>(
        "SELECT ref, ip, phone, first_name, anonymized_at FROM landing_leads ORDER BY ref"
      )).rows
      expect(rows.find((x) => x.ref === "E2B-ABC234")).toMatchObject({ ip: null, phone: "21698140514" })
      expect(rows.find((x) => x.ref === "E2B-OLD234")).toMatchObject({ phone: null, first_name: "Anonymisé" })
      expect(rows.find((x) => x.ref === "E2B-RES234")).toMatchObject({ phone: "21622000002", anonymized_at: null }) // réservé : 36 mois
      expect((await db.query("SELECT 1 FROM landing_lead_activities WHERE type = 'anonymized'")).rows).toHaveLength(1)
    })

    it("la purge n'est pas exécutable par un compte connecté", async () => {
      await expect(as("authenticated", STAFF, () => db.query("SELECT public.landing_purge_personal_data()"))).rejects.toThrow(/permission denied/)
    })
  })
})
