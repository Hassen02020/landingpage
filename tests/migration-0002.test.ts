import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 + 0002 exécutées sur PostgreSQL (PGlite), avec rôles et schéma auth simulés comme sur Supabase.
const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const M1 = read("0001_landing_leads.sql")
const M2 = read("0002_landing_crm.sql")
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
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

    it("aucun compte connecté (même membre) ne peut modifier un lead directement par l'API", async () => {
      for (const uid of [OTHER, STAFF]) {
        await expect(as("authenticated", uid, () => db.query(`UPDATE landing_leads SET status = 'perdu' WHERE id = '${leadId}'`))).rejects.toThrow(/permission denied/)
      }
      expect((await db.query<{ status: string }>("SELECT status FROM landing_leads")).rows[0].status).toBe("nouveau")
    })

    it("anon reste sans aucun droit", async () => {
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_leads"))).rejects.toThrow(/permission denied/)
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_lead_activities"))).rejects.toThrow(/permission denied/)
      await expect(as("anon", null, () => db.query("SELECT * FROM landing_staff"))).rejects.toThrow(/permission denied/)
    })

    it("historique : aucune écriture directe par un compte connecté ; aucune modification ni suppression", async () => {
      await expect(
        as("authenticated", STAFF, () =>
          db.query(`INSERT INTO landing_lead_activities (lead_id, actor_id, actor_label, type, body) VALUES ('${leadId}', '${STAFF}', 'agent', 'note', 'Appel')`)
        )
      ).rejects.toThrow(/permission denied/)
      await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type, body) VALUES ('${leadId}', 'système', 'note', 'Appel')`)
      expect(await as("authenticated", STAFF, async () => (await db.query("SELECT id FROM landing_lead_activities")).rows.length)).toBe(1)
      await expect(db.query("UPDATE landing_lead_activities SET body = 'modifié'")).rejects.toThrow(/ajout seul/)
      await expect(db.query("UPDATE landing_lead_activities SET body = NULL")).rejects.toThrow(/ajout seul/) // hors purge
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
        INSERT INTO landing_events (event_name, event_id, visitor_id, created_at) VALUES
          ('Contact', 'evt-old-00001', 'v-old', now() - interval '14 months'),
          ('Contact', 'evt-mid-00001', 'v-mid', now() - interval '100 days'),
          ('Contact', 'evt-new-00001', 'v-new', now());`)
      const oldLost = await addLead({ ref: "E2B-OLD234", idempotency_key: "evt-00000002", phone: "21622000001", status: "perdu" })
      const oldBooked = await addLead({ ref: "E2B-RES234", idempotency_key: "evt-00000003", phone: "21622000002", status: "reserve", booked_at: new Date(Date.now() - 25 * 30 * 864e5).toISOString(), booking_value: 4800 })
      await db.exec(`
        INSERT INTO landing_lead_activities (lead_id, actor_label, type, body, created_at) VALUES
          ('${oldLost}', 'agent', 'note', 'Appelé au 22000001, mariage en juin', now() - interval '25 months'),
          ('${oldBooked}', 'agent', 'note', 'Réservé, paie en 2 fois', now() - interval '25 months');
        UPDATE landing_leads SET created_at = now() - interval '25 months', last_activity_at = now() - interval '25 months'
         WHERE id IN ('${oldLost}', '${oldBooked}');`)

      const r = await as("service_role", null, () => db.query<{ r: Record<string, number> }>("SELECT public.landing_purge_personal_data() AS r"))
      expect((r as { rows: { r: Record<string, number> }[] }).rows[0].r).toEqual({ identifiants_effaces: 1, evenements_supprimes: 1, leads_anonymises: 1 })

      const rows = (await db.query<{ ref: string; ip: string | null; phone: string | null; first_name: string; anonymized_at: Date | null }>(
        "SELECT ref, ip, phone, first_name, anonymized_at FROM landing_leads ORDER BY ref"
      )).rows
      expect(rows.find((x) => x.ref === "E2B-ABC234")).toMatchObject({ ip: null, phone: "21698140514" })
      expect(rows.find((x) => x.ref === "E2B-OLD234")).toMatchObject({ phone: null, first_name: "Anonymisé" })
      expect(rows.find((x) => x.ref === "E2B-RES234")).toMatchObject({ phone: "21622000002", anonymized_at: null }) // réservé : 36 mois
      expect((await db.query("SELECT 1 FROM landing_lead_activities WHERE type = 'anonymized'")).rows).toHaveLength(1)
      // notes de l'historique effacées pour le lead anonymisé, conservées pour le lead réservé (36 mois)
      const notes = (await db.query<{ lead_id: string; body: string | null }>("SELECT lead_id, body FROM landing_lead_activities WHERE type = 'note'")).rows
      expect(notes.find((n) => n.lead_id === oldLost)?.body).toBeNull()
      expect(notes.find((n) => n.lead_id === oldBooked)?.body).toBe("Réservé, paie en 2 fois")
      // identifiant visiteur des événements effacé après 90 jours
      const ev = (await db.query<{ event_id: string; visitor_id: string | null }>("SELECT event_id, visitor_id FROM landing_events ORDER BY event_id")).rows
      expect(ev).toEqual([{ event_id: "evt-mid-00001", visitor_id: null }, { event_id: "evt-new-00001", visitor_id: "v-new" }])
    })

    it("service_role : droits minimaux (ni DELETE ni TRUNCATE, équipe en lecture seule)", async () => {
      const expected: Record<string, string> = {
        landing_leads: "SELECT,INSERT,UPDATE",
        landing_events: "SELECT,INSERT",
        landing_lead_activities: "SELECT,INSERT",
        landing_staff: "SELECT",
        landing_campaign_performance: "SELECT",
        landing_niche_performance: "SELECT",
      }
      for (const [rel, want] of Object.entries(expected)) {
        const got: string[] = []
        for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
          if ((await db.query<{ ok: boolean }>("SELECT has_table_privilege('service_role', $1, $2) AS ok", [`public.${rel}`, p])).rows[0].ok) got.push(p)
        }
        expect(`${rel}:${got.join(",")}`).toBe(`${rel}:${want}`)
      }
    })

    it("service_role : le code du site fonctionne (insertion lead + historique, mise à jour) ; suppression et vidage refusés", async () => {
      await as("service_role", null, async () => {
        const r = await db.query<{ id: string }>(
          "INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent) VALUES ('E2B-SRV234','evt-srv-0001','Srv','21622000099','hotel',true) RETURNING id"
        )
        await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ('${r.rows[0].id}', 'système', 'created')`)
        await db.query(`INSERT INTO landing_events (event_name, event_id) VALUES ('Contact', 'evt-srv-0002')`)
        await db.query(`UPDATE landing_leads SET status = 'contacte' WHERE id = '${r.rows[0].id}'`)
      })
      for (const sql of ["DELETE FROM landing_leads", "TRUNCATE landing_events", "DELETE FROM landing_events",
        `INSERT INTO landing_staff (user_id, email) VALUES ('${OTHER}', 'intrus@x.tn')`, `UPDATE landing_staff SET role = 'admin'`]) {
        await expect(as("service_role", null, () => db.query(sql))).rejects.toThrow(/permission denied/)
      }
    })

    it("historique : TRUNCATE interdit à tous, même au propriétaire", async () => {
      await expect(db.query("TRUNCATE landing_lead_activities")).rejects.toThrow(/TRUNCATE interdit/)
    })

    it("lead anonymisé : aucune modification (service_role ni propriétaire), effacement possible", async () => {
      await db.exec("SELECT set_config('landing.purge', 'on', false)")
      await db.query(`UPDATE landing_leads SET anonymized_at = now(), phone = NULL, first_name = 'Anonymisé' WHERE id = '${leadId}'`)
      await db.exec("SELECT set_config('landing.purge', 'off', false)")
      await expect(as("service_role", null, () => db.query(`UPDATE landing_leads SET phone = '21698140514' WHERE id = '${leadId}'`))).rejects.toThrow(/anonymisé/)
      await expect(db.query(`UPDATE landing_leads SET status = 'contacte' WHERE id = '${leadId}'`)).rejects.toThrow(/anonymisé/)
      await db.query(`DELETE FROM landing_leads WHERE id = '${leadId}'`)
      expect((await db.query("SELECT 1 FROM landing_leads")).rows).toHaveLength(0)
    })

    it("anonymisation manuelle refusée hors purge", async () => {
      await expect(as("service_role", null, () => db.query(`UPDATE landing_leads SET anonymized_at = now() WHERE id = '${leadId}'`))).rejects.toThrow(/réservée/)
    })

    it("date de réservation définitive : impossible de la retirer ou de la changer ; le statut reste modifiable", async () => {
      await db.query(`UPDATE landing_leads SET status = 'reserve', booking_value = 4800, booked_at = now() WHERE id = '${leadId}'`)
      await expect(as("service_role", null, () => db.query(`UPDATE landing_leads SET status = 'perdu', booked_at = NULL WHERE id = '${leadId}'`))).rejects.toThrow(/réservation/)
      await expect(db.query(`UPDATE landing_leads SET booked_at = now() + interval '1 day' WHERE id = '${leadId}'`)).rejects.toThrow(/réservation/)
      await as("service_role", null, () => db.query(`UPDATE landing_leads SET status = 'perdu' WHERE id = '${leadId}'`))
      expect((await db.query<{ status: string; booked: boolean }>("SELECT status, booked_at IS NOT NULL AS booked FROM landing_leads")).rows[0]).toEqual({ status: "perdu", booked: true })
    })

    it("dernière interaction : mise à jour par chaque activité (sauf anonymisation)", async () => {
      await db.query(`UPDATE landing_leads SET last_activity_at = now() - interval '10 days' WHERE id = '${leadId}'`)
      await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type, body) VALUES ('${leadId}', 'agent', 'note', 'Rappel')`)
      const after = (await db.query<{ recent: boolean }>("SELECT last_activity_at > now() - interval '1 minute' AS recent FROM landing_leads")).rows[0]
      expect(after.recent).toBe(true)
    })

    it("purge : un client réservé récemment ou recontacté récemment n'est PAS anonymisé", async () => {
      const booked = await addLead({ ref: "E2B-BKD234", idempotency_key: "evt-00000020", phone: "21622000020" })
      await db.query(`UPDATE landing_leads SET created_at = now() - interval '37 months', last_activity_at = now() - interval '37 months',
        status = 'reserve', booking_value = 5000, booked_at = now() - interval '2 days' WHERE id = '${booked}'`)
      const contacted = await addLead({ ref: "E2B-CTD234", idempotency_key: "evt-00000021", phone: "21622000021" })
      await db.query(`UPDATE landing_leads SET created_at = now() - interval '25 months', last_activity_at = now() - interval '25 months', status = 'qualifie' WHERE id = '${contacted}'`)
      await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type, body, created_at) VALUES ('${contacted}', 'agent', 'note', 'Rappel hier', now() - interval '1 day')`)
      const idle = await addLead({ ref: "E2B-IDL234", idempotency_key: "evt-00000022", phone: "21622000022" })
      await db.query(`UPDATE landing_leads SET created_at = now() - interval '25 months', last_activity_at = now() - interval '25 months', status = 'perdu' WHERE id = '${idle}'`)

      await as("service_role", null, () => db.query("SELECT public.landing_purge_personal_data()"))
      const rows = (await db.query<{ ref: string; anonymise: boolean; booking_value: string | null }>(
        "SELECT ref, anonymized_at IS NOT NULL AS anonymise, booking_value FROM landing_leads WHERE ref IN ('E2B-BKD234','E2B-CTD234','E2B-IDL234') ORDER BY ref"
      )).rows
      expect(rows).toEqual([
        { ref: "E2B-BKD234", anonymise: false, booking_value: "5000.00" },
        { ref: "E2B-CTD234", anonymise: false, booking_value: null },
        { ref: "E2B-IDL234", anonymise: true, booking_value: null },
      ])
    })

    it("aucune purge n'est planifiée automatiquement (durées non validées)", async () => {
      expect((await db.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'")).rows).toHaveLength(0)
    })

    it("la purge n'est pas exécutable par un compte connecté", async () => {
      await expect(as("authenticated", STAFF, () => db.query("SELECT public.landing_purge_personal_data()"))).rejects.toThrow(/permission denied/)
    })
  })
})
