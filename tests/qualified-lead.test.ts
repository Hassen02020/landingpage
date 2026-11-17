// Lot 5 : évènement « lead qualifié » vers Meta — une seule fois par lead, avec consentement, sans valeur monétaire, jamais depuis le navigateur.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { changeStatus, getLead, type LeadRow } from "@/lib/server/crm"
import { ALLOWED_EVENTS } from "@/lib/server/events"
import { configureAll, installFetchMock } from "./helpers"

const actor = { id: "11111111-1111-1111-1111-111111111111", label: "manager@easy2book.tn" }
function seedLead(f: ReturnType<typeof installFetchMock>, o: Partial<LeadRow> = {}): LeadRow {
  const lead = {
    id: crypto.randomUUID(), created_at: new Date().toISOString(), ref: "E2B-ABC234", visitor_ref: null, first_name: "Sana", last_name: null,
    phone: "21655123456", product: "omra", offer: "Omra Ramadan complet", niche: null, destination: null, travel_date: null, travel_period: null,
    adults: 2, children: 0, budget: null, message: null, status: "nouveau", booking_value: null, booked_at: null, notes: null,
    marketing_consent: true, tracking_consent: true, channel: "meta", utm_source: null, utm_campaign: null, utm_content: null, ad_id: null,
    landing_page: null, visitor_id: "v1", fbp: "fb.1.1.1", fbc: "fb.1.1.2", ttp: null, ttclid: null, ip: "1.2.3.4", user_agent: "UA", ...o,
  } as LeadRow
  f.db.landing_leads.push({ ...lead })
  return lead
}
const names = (f: ReturnType<typeof installFetchMock>) => f.meta().map((c) => c.body.data[0].event_name)
beforeEach(() => configureAll())
afterEach(() => vi.unstubAllEnvs())

describe("lead qualifié : première qualification seulement", () => {
  it("contacté → qualifié : un évènement QualifiedLead, identifiant stable, sans valeur monétaire, données hachées", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    expect(await changeStatus(lead, "contacte", actor)).toEqual({ ok: true, conversion: null })
    expect(names(f)).toEqual([])
    const r = await changeStatus(lead, "qualifie", actor)
    expect(r).toEqual({ ok: true, conversion: null, qualified: "envoyé" })
    const ev = f.meta()[0].body.data[0]
    expect(ev).toMatchObject({ event_name: "QualifiedLead", event_id: `qualified-${lead.id}`, action_source: "chat" })
    expect(ev.custom_data).not.toHaveProperty("value")
    expect(ev.custom_data).not.toHaveProperty("currency")
    expect(JSON.stringify(ev)).not.toContain("21655123456") // téléphone haché, jamais en clair
    expect(ev.user_data.ph).toHaveLength(1)
  })

  it("jamais deux fois : qualifié → contacté → qualifié, puis → devis, n'envoie rien de plus", async () => {
    const f = installFetchMock(); let lead = seedLead(f)
    await changeStatus(lead, "qualifie", actor)
    lead = (await getLead(lead.id))!
    await changeStatus(lead, "contacte", actor)
    lead = (await getLead(lead.id))!
    await changeStatus(lead, "qualifie", actor)
    lead = (await getLead(lead.id))!
    await changeStatus(lead, "devis", actor)
    expect(names(f)).toEqual(["QualifiedLead"])
  })

  it("un lead perdu puis rouvert en « qualifié » après avoir déjà été qualifié : aucun nouvel évènement", async () => {
    const f = installFetchMock(); let lead = seedLead(f)
    await changeStatus(lead, "qualifie", actor); lead = (await getLead(lead.id))!
    await changeStatus(lead, "perdu", actor); lead = (await getLead(lead.id))!
    await changeStatus(lead, "qualifie", actor)
    expect(names(f)).toEqual(["QualifiedLead"])
  })

  it("passage direct à « devis » (sans passer par qualifié) : compte comme qualification, une seule fois", async () => {
    const f = installFetchMock(); let lead = seedLead(f)
    expect(await changeStatus(lead, "devis", actor)).toMatchObject({ ok: true, qualified: "envoyé" })
    lead = (await getLead(lead.id))!
    await changeStatus(lead, "negociation", actor)
    expect(names(f)).toEqual(["QualifiedLead"])
  })

  it("réservation directe : QualifiedLead puis Purchase, deux évènements distincts, la vente garde sa valeur", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    const r = await changeStatus(lead, "reserve", actor, { bookingValue: 5900 })
    expect(r).toEqual({ ok: true, conversion: "envoyée", qualified: "envoyé" })
    expect(names(f).sort()).toEqual(["Purchase", "QualifiedLead"])
    const purchase = f.meta().map((c) => c.body.data[0]).find((e) => e.event_name === "Purchase")!
    expect(purchase.custom_data.value).toBe(5900)
  })

  it("pas d'évènement pour les statuts non qualifiés (contacté, à qualifier, perdu)", async () => {
    const f = installFetchMock(); let lead = seedLead(f)
    for (const st of ["a_contacter", "contacte", "a_qualifier", "perdu"] as const) { await changeStatus(lead, st, actor); lead = (await getLead(lead.id))! }
    expect(names(f)).toEqual([])
  })
})

describe("consentement, configuration et sécurité", () => {
  it("sans consentement de suivi : aucun évènement, le CRM le dit", async () => {
    const f = installFetchMock(); const lead = seedLead(f, { tracking_consent: false })
    expect(await changeStatus(lead, "qualifie", actor)).toEqual({ ok: true, conversion: null, qualified: "sans consentement" })
    expect(names(f)).toEqual([])
  })

  it("Meta non configuré : statut enregistré, aucune erreur, pas de fausse mention « envoyé »", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", ""); vi.stubEnv("META_PIXEL_ID", "")
    const f = installFetchMock(); const lead = seedLead(f)
    const r = await changeStatus(lead, "qualifie", actor)
    expect(r.ok).toBe(true)
    expect((r as { qualified?: string }).qualified).toBeUndefined()
    expect(f.db.landing_leads[0].status).toBe("qualifie")
  })

  it("historique illisible : on n'envoie RIEN (jamais de doublon en cas de doute), le statut est enregistré", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    const base = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (u: unknown, i?: RequestInit) => (String(u).includes("landing_lead_activities") && (i?.method ?? "GET") === "GET" ? new Response("{}", { status: 500 }) : base(u as string, i))))
    const r = await changeStatus(lead, "qualifie", actor)
    expect(r.ok).toBe(true)
    expect(names(f)).toEqual([])
    expect(f.db.landing_leads[0].status).toBe("qualifie")
  })

  it("jamais relayé depuis le navigateur : absent de la liste des évènements publics", () => {
    expect(ALLOWED_EVENTS.has("QualifiedLead")).toBe(false)
    expect(ALLOWED_EVENTS.has("Purchase")).toBe(false)
    expect(ALLOWED_EVENTS.has("Lead")).toBe(false)
  })
})
