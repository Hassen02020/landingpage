import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addNote, assignLead, changeStatus, createManualLead, getLead, listLeads, setFollowUp, withdrawMarketing, type LeadRow } from "@/lib/server/crm"
import { configureAll, installFetchMock, DB_URL } from "./helpers"

const actor = { id: "11111111-1111-1111-1111-111111111111", label: "agent@easy2book.tn" }

function seedLead(f: ReturnType<typeof installFetchMock>, o: Partial<LeadRow> = {}): LeadRow {
  const lead = {
    id: crypto.randomUUID(), created_at: new Date().toISOString(), ref: "E2B-ABC234", visitor_ref: null, first_name: "Sana", last_name: null,
    phone: "21655123456", product: "omra", offer: null, niche: null, destination: null, travel_date: null, travel_period: null,
    adults: 2, children: 0, budget: null, message: null, status: "nouveau", booking_value: null, booked_at: null, notes: null,
    marketing_consent: true, tracking_consent: true, channel: "meta", utm_source: null, utm_campaign: null, utm_content: null, ad_id: null,
    landing_page: null, visitor_id: "v1", fbp: null, fbc: null, ttp: null, ttclid: null, ip: null, user_agent: null, ...o,
  } as LeadRow
  f.db.landing_leads.push({ ...lead })
  return lead
}

beforeEach(() => configureAll())
afterEach(() => vi.unstubAllEnvs())

describe("changeStatus", () => {
  it("trace le changement dans l'historique avec l'auteur", async () => {
    const f = installFetchMock()
    const lead = seedLead(f)
    expect(await changeStatus(lead, "contacte", actor)).toEqual({ ok: true, conversion: null })
    expect(f.db.landing_leads[0].status).toBe("contacte")
    expect(f.db.landing_lead_activities[0]).toMatchObject({ lead_id: lead.id, actor_id: actor.id, actor_label: actor.label, type: "status_change", from_status: "nouveau", to_status: "contacte" })
  })

  it("réservation : vente envoyée UNE seule fois, même après réservé → perdu → réservé", async () => {
    const f = installFetchMock()
    let lead = seedLead(f)
    expect(await changeStatus(lead, "reserve", actor, { bookingValue: 4800 })).toEqual({ ok: true, conversion: "envoyée" })
    lead = (await getLead(lead.id))!
    await changeStatus(lead, "perdu", actor)
    lead = (await getLead(lead.id))!
    expect(await changeStatus(lead, "reserve", actor, { bookingValue: 4800 })).toEqual({ ok: true, conversion: null })
    expect(f.meta().filter((c) => c.body.data[0].event_name === "Purchase")).toHaveLength(1)
  })

  it("réservation sans montant refusée ; lead anonymisé verrouillé", async () => {
    const f = installFetchMock()
    const lead = seedLead(f)
    expect(await changeStatus(lead, "reserve", actor)).toEqual({ ok: false, error: "Montant de la réservation obligatoire" })
    expect(await changeStatus({ ...lead, anonymized_at: new Date().toISOString() }, "contacte", actor)).toMatchObject({ ok: false })
    expect(f.dbCalls().filter((c) => c.method === "PATCH")).toHaveLength(0)
  })
})

describe("listLeads", () => {
  it("n'envoie jamais une recherche non valide à Supabase", async () => {
    const f = installFetchMock()
    expect(await listLeads({ q: "a),phone.neq.0,(b" })).toEqual([])
    expect(await listLeads({ status: "x;drop", product: "evil", channel: "META,1" })).toEqual([])
    const url = decodeURIComponent(f.dbCalls()[0].url)
    expect(url).not.toMatch(/status=|product=|channel=/)
  })

  it("recherche par référence, téléphone ou nom", async () => {
    const f = installFetchMock()
    await listLeads({ q: "e2b-abc234" })
    await listLeads({ q: "98 140 514" })
    await listLeads({ q: "Ben Ali" })
    const urls = f.dbCalls().map((c) => decodeURIComponent(c.url))
    expect(urls[0]).toContain("or=(ref.eq.E2B-ABC234,visitor_ref.eq.E2B-ABC234)")
    expect(urls[1]).toContain("phone=like.*98140514*")
    expect(urls[2]).toContain("first_name.ilike.*Ben Ali*")
  })
})

describe("createManualLead", () => {
  it("crée un lead WhatsApp sans consentement marketing ni traceurs, assigné à son auteur", async () => {
    const f = installFetchMock()
    const r = await createManualLead({ name: "Karim Haddad", phone: "22 123 456", product: "voyage", source: "whatsapp" }, actor)
    expect(r).toMatchObject({ ok: true })
    expect(f.db.landing_leads[0]).toMatchObject({ phone: "21622123456", source: "whatsapp", marketing_consent: false, tracking_consent: false, assigned_to: actor.id, contact_consent: true })
    expect(f.db.landing_lead_activities[0]).toMatchObject({ type: "created", actor_id: actor.id })
  })

  it("refuse les entrées invalides et la source « formulaire »", async () => {
    installFetchMock()
    expect(await createManualLead({ name: "K", phone: "22123456", product: "voyage", source: "whatsapp" }, actor)).toMatchObject({ ok: false })
    expect(await createManualLead({ name: "Karim", phone: "12", product: "voyage", source: "whatsapp" }, actor)).toMatchObject({ ok: false })
    expect(await createManualLead({ name: "Karim", phone: "22123456", product: "croisiere", source: "whatsapp" }, actor)).toMatchObject({ ok: false })
    expect(await createManualLead({ name: "Karim", phone: "22123456", product: "voyage", source: "form" }, actor)).toMatchObject({ ok: false })
  })

  it("signale un doublon du jour (même téléphone + produit)", async () => {
    installFetchMock()
    await createManualLead({ name: "Karim Haddad", phone: "22123456", product: "voyage", source: "whatsapp" }, actor)
    const second = await createManualLead({ name: "Karim Haddad", phone: "22123456", product: "voyage", source: "phone" }, actor)
    expect(second).toMatchObject({ ok: false })
    expect((second as { error: string }).error).toMatch(/déjà une demande/)
  })
})

describe("withdrawMarketing", () => {
  it("retire le consentement et le trace", async () => {
    const f = installFetchMock()
    const lead = seedLead(f)
    await withdrawMarketing(lead, actor)
    expect(f.db.landing_leads[0].marketing_consent).toBe(false)
    expect(f.db.landing_leads[0].marketing_withdrawn_at).toBeTruthy()
    expect(f.db.landing_lead_activities[0].type).toBe("marketing_withdrawn")
    expect(DB_URL).toContain("landing-sb.test")
  })
})

describe("lead anonymisé", () => {
  it("toute modification est refusée (note, relance, assignation, consentement, statut)", async () => {
    const f = installFetchMock()
    const lead = seedLead(f, { anonymized_at: new Date().toISOString() } as Partial<LeadRow>)
    for (const r of [
      await addNote(lead, "texte", actor),
      await setFollowUp(lead, new Date().toISOString(), actor),
      await assignLead(lead, actor.id, actor),
      await withdrawMarketing(lead, actor),
      await changeStatus(lead, "contacte", actor),
    ]) expect(r).toMatchObject({ ok: false, error: expect.stringContaining("anonymisé") })
    expect(f.dbCalls().filter((c) => c.method !== "GET")).toHaveLength(0)
  })
})
