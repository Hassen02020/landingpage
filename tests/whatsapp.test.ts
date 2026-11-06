import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { describeAttachment, lookupConversation, parseWaRef, type Conversation } from "@/lib/server/whatsapp"
import { whatsappFunnel } from "@/lib/server/whatsapp-stats"
import { createManualLead, logWhatsApp, type LeadRow } from "@/lib/server/crm"
import { refFromVisitorId } from "@/lib/attribution"
import { randomRef } from "@/lib/server/hash"
import { configureAll, installFetchMock } from "./helpers"

const actor = { id: "11111111-1111-4111-8111-111111111111", label: "agent@easy2book.tn" }
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("référence WhatsApp « Réf: E2B-… »", () => {
  it("extrait la référence d'un message collé, en majuscules, quel que soit le texte autour", () => {
    expect(parseWaRef("السلام عليكم Easy2Book\n\nRéf: E2B-LFQBVR")).toBe("E2B-LFQBVR")
    expect(parseWaRef("réf e2b-lfqbvr merci")).toBe("E2B-LFQBVR")
    expect(parseWaRef("E2B-LFQBVR")).toBe("E2B-LFQBVR")
    for (const bad of ["", "E2B-12", "Réf: ABC-123456", "pas de référence", null, undefined]) expect(parseWaRef(bad as string)).toBeNull()
  })

  it("les références produites par le site (visiteur et lead) sont toujours reconnues", () => {
    for (let i = 0; i < 200; i++) {
      expect(parseWaRef(`Réf: ${randomRef()}`)).not.toBeNull()
      expect(parseWaRef(`Réf: ${refFromVisitorId(crypto.randomUUID())}`)).not.toBeNull()
    }
  })
})

describe("rattachement d'une conversation à son clic d'origine", () => {
  const click = { created_at: "2026-11-02T10:00:00Z", location: "hero", product: "omra", offer: null, niche: "omra-ramadan-2027", channel: "meta", utm_source: "instagram", utm_campaign: "bio", utm_content: null, ad_id: null }

  it("retrouve le lead (par référence ou par visiteur) et les clics, du plus récent au plus ancien", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [{ id: "L1", ref: "E2B-AAA222", visitor_ref: "E2B-VIS222", first_name: "Ahmed", status: "nouveau", anonymized_at: null }]
    f.db.landing_events = [{ id: 1, event_name: "Contact", visitor_ref: "E2B-VIS222", ...click }]
    expect((await lookupConversation("E2B-AAA222")).lead?.id).toBe("L1")
    const byVisitor = await lookupConversation("E2B-VIS222")
    expect(byVisitor.lead?.id).toBe("L1")
    expect(byVisitor.clicks).toHaveLength(1)
    expect((await lookupConversation("E2B-NONE22")).lead).toBeNull()
  })

  it("le texte d'historique n'affirme jamais une origine qu'il n'a pas retrouvée", () => {
    const none: Conversation = { ref: "E2B-X", lead: null, clicks: [] }
    expect(describeAttachment(none)).toContain("origine inconnue")
    expect(describeAttachment({ ...none, clicks: [click] })).toMatch(/rattaché au clic du .*« hero ».*source instagram, campagne bio/)
  })

  it("Nouveau lead + message collé : le clic d'origine donne le canal, la source et la campagne ; le lead est assigné au conseiller", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_events = [{ id: 1, event_name: "Contact", visitor_ref: "E2B-VIS222", ...click }]
    const res = await createManualLead({ name: "Sami Test", phone: "97123456", product: "omra", source: "whatsapp", waRef: "Salam\n\nRéf: E2B-VIS222" }, actor)
    expect(res).toMatchObject({ ok: true, attached: "click" })
    expect(f.db.landing_leads[0]).toMatchObject({ source: "whatsapp", visitor_ref: "E2B-VIS222", channel: "meta", utm_source: "instagram", utm_campaign: "bio", assigned_to: actor.id, tracking_consent: false })
    for (const k of ["fbclid", "ttclid", "visitor_id", "ip", "user_agent"]) expect(f.db.landing_leads[0][k]).toBeUndefined() // aucun identifiant publicitaire copié
    const log = f.db.landing_lead_activities.map((a) => a.type + ":" + a.body)
    expect(log.some((l) => l.startsWith("created:") && l.includes("rattaché au clic"))).toBe(true)
    expect(log.some((l) => l.startsWith("wa_in:"))).toBe(true)
  })

  it("référence sans clic retrouvé : lead créé, origine déclarée INCONNUE (rien d'inventé)", async () => {
    configureAll()
    const f = installFetchMock()
    const res = await createManualLead({ name: "Rim Test", phone: "97123457", product: "omra", source: "whatsapp", waRef: "E2B-OLD222" }, actor)
    expect(res).toMatchObject({ ok: true, attached: "none" })
    expect(f.db.landing_leads[0].channel).toBeUndefined()
    expect(f.db.landing_leads[0].visitor_ref).toBe("E2B-OLD222")
    expect(f.db.landing_lead_activities.find((a) => a.type === "created").body).toContain("origine inconnue")
  })

  it("le visiteur a déjà un lead : le message est ajouté à son historique, AUCUN doublon", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [{ id: "L1", ref: "E2B-AAA222", visitor_ref: "E2B-VIS222", first_name: "Ahmed", status: "nouveau", anonymized_at: null }]
    const res = await createManualLead({ name: "Ahmed Ben Ali", phone: "98140514", product: "omra", source: "whatsapp", waRef: "Réf: E2B-VIS222", message: "Demande les dates" }, actor)
    expect(res).toMatchObject({ ok: true, existing: true, id: "L1", ref: "E2B-AAA222" })
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.db.landing_lead_activities.at(-1)).toMatchObject({ lead_id: "L1", type: "wa_in" })
  })

  it("texte sans référence valide : refusé ; saisie sans référence : inchangée (rétrocompatible)", async () => {
    configureAll()
    installFetchMock()
    expect(await createManualLead({ name: "Test Test", phone: "97123458", product: "omra", source: "whatsapp", waRef: "bonjour sans ref" }, actor)).toMatchObject({ ok: false })
    expect(await createManualLead({ name: "Test Test", phone: "97123458", product: "omra", source: "phone" }, actor)).toMatchObject({ ok: true })
  })

  it("échanges saisis : reçu / envoyé tracés ; lead anonymisé verrouillé", async () => {
    configureAll()
    const f = installFetchMock()
    const lead = { id: "L1", anonymized_at: null } as LeadRow
    expect(await logWhatsApp(lead, "in", "Veut le prix pour 4 personnes", actor)).toEqual({ ok: true })
    expect(await logWhatsApp(lead, "out", "", actor)).toEqual({ ok: true })
    expect(f.db.landing_lead_activities.map((a) => a.type)).toEqual(["wa_in", "wa_out"])
    expect((await logWhatsApp({ id: "L2", anonymized_at: "2026-01-01" } as LeadRow, "in", "x", actor)).ok).toBe(false)
  })
})

describe("entonnoir WhatsApp : chaque étape garde sa nature", () => {
  it("clics ≠ conversations ≠ réservations ; rattachement calculé sur les leads WhatsApp saisis", () => {
    const clicks = [{ visitor_ref: "E2B-AAA222" }, { visitor_ref: "E2B-AAA222" }, { visitor_ref: "E2B-BBB222" }, { visitor_ref: null }]
    const leads = [
      { id: "1", source: "whatsapp", status: "reserve", visitor_ref: "E2B-AAA222", booking_value: "11000" },
      { id: "2", source: "whatsapp", status: "nouveau", visitor_ref: null, booking_value: null },
      { id: "3", source: "form", status: "reserve", visitor_ref: "E2B-BBB222", booking_value: 5500 },
      { id: "4", source: "form", status: "reserve", visitor_ref: null, booking_value: 7800 }, // formulaire pur : pas WhatsApp
      { id: "5", source: "form", status: "contacte", visitor_ref: null, booking_value: null },
    ]
    const acts = [{ lead_id: "2", type: "wa_in" }, { lead_id: "2", type: "wa_out" }, { lead_id: "5", type: "wa_in" }, { lead_id: "1", type: "note" }]
    const f = whatsappFunnel(clicks, leads, acts)
    expect(f).toMatchObject({ clicks: 4, visitorsClicked: 2, formLeads: 3, whatsappLeads: 2, attachedLeads: 2, messagesIn: 2, messagesOut: 1, conversations: 2 })
    expect(f.whatsappAttachedRate).toBe(0.5)
    expect(f.reserved).toBe(2) // 1 (source WhatsApp) + 3 (clic rattaché) ; le 4 est un formulaire sans WhatsApp
    expect(f.revenue).toBe(16500)
  })

  it("aucune donnée : zéros, jamais NaN", () => {
    expect(Object.values(whatsappFunnel([], [], [])).every((v) => Number.isFinite(v))).toBe(true)
  })
})

describe("migration 0006 : échanges WhatsApp saisis", () => {
  const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
  const ALL = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql"].map(read).join("\n")
  const STUB = `
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`

  it("accepte wa_in / wa_out, refuse un type inconnu, garde l'historique en ajout seul", async () => {
    const db = new PGlite()
    await db.exec(STUB + ALL)
    const lead = await db.query<{ id: string }>("INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent) VALUES ('E2B-ABC234','evt-00000001','A','21698140514','omra',true) RETURNING id")
    const id = lead.rows[0].id
    await db.exec("SET ROLE service_role")
    await db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type, body) VALUES ('${id}', 'agent', 'wa_in', 'Veut les dates'), ('${id}', 'agent', 'wa_out', NULL)`)
    await expect(db.query(`INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ('${id}', 'agent', 'sms')`)).rejects.toThrow(/check/i)
    await expect(db.query("UPDATE landing_lead_activities SET body = 'x'")).rejects.toThrow(/permission denied|ajout seul/)
    await db.exec("RESET ROLE")
    expect((await db.query("SELECT 1 FROM landing_lead_activities WHERE type IN ('wa_in','wa_out')")).rows).toHaveLength(2)
  })
})
