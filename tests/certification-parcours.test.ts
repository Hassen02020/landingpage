// CERTIFICATION — évènements Meta, parcours commercial complet et rentabilité. Jeux de données FICTIFS, aucun appel réseau réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { changeStatus, getLead, setTestFlag, type LeadRow } from "@/lib/server/crm"
import { __resetGuards } from "@/lib/server/guard"
import { groupCustomers } from "@/lib/server/customer"
import { economics, type CommissionRow, type CostRow, type EconLead, type SpendRow } from "@/lib/ad-economics"
import { funnel, type FunnelActivity } from "@/lib/server/analytics"
import { configureAll, installFetchMock, post } from "./helpers"

const actor = { id: "11111111-1111-1111-1111-111111111111", label: "manager@easy2book.tn" }
const mk = (o: Record<string, unknown> = {}) => ({
  eventId: "cert-evt-00001", name: "Sana Ben Ali", phone: "98 140 514", product: "omra", offer: "Omra Ramadan complet", adults: 2, children: 0, region: "Tunis",
  contactConsent: true, marketingConsent: false, trackingConsent: true,
  attribution: { visitor_id: "v-cert-1", fbp: "fb.1.1.1", fbc: "fb.1.1.2", last_touch: { channel: "meta", utm_source: "facebook", utm_medium: "paid", utm_campaign: "omra-ramadan-2027-fb", utm_term: "tunisie-arabe-fr", utm_content: "video-omra-ramadan", landing_page: "/p/omra-ramadan-complet" }, first_touch: { channel: "meta", utm_source: "facebook", utm_campaign: "omra-ramadan-2027-fb" } },
  ...o,
})
const events = (f: ReturnType<typeof installFetchMock>) => f.meta().map((c) => c.body.data[0])
const names = (f: ReturnType<typeof installFetchMock>) => events(f).map((e) => e.event_name)
beforeEach(() => { __resetGuards(); configureAll() })
afterEach(() => vi.unstubAllEnvs())

describe("CERT P0 — évènements Meta : Lead, QualifiedLead, Purchase", () => {
  it("cycle complet : 1 Lead, 1 QualifiedLead, 1 Purchase — chacun avec un identifiant stable et distinct, jamais de doublon", async () => {
    const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk()))
    expect((await res.json()).ok).toBe(true)
    // rejeu du même envoi + nouvelle demande du même numéro : aucun second Lead
    await leadsPOST(post("/api/leads", mk())); __resetGuards()
    await leadsPOST(post("/api/leads", mk({ eventId: "cert-evt-00002" })))
    expect(names(f)).toEqual(["Lead"])
    expect(events(f)[0].event_id).toBe("cert-evt-00001") // identique à celui du pixel navigateur : Meta déduplique

    let lead = (await getLead(f.db.landing_leads[0].id))!
    for (const st of ["contacte", "qualifie", "devis", "negociation"] as const) { await changeStatus(lead, st, actor); lead = (await getLead(lead.id))! }
    await changeStatus(lead, "reserve", actor, { bookingValue: 5900, purchasedProduct: "omra" }); lead = (await getLead(lead.id))!
    await changeStatus(lead, "gagne", actor); lead = (await getLead(lead.id))!
    await changeStatus(lead, "perdu", actor); lead = (await getLead(lead.id))!
    await changeStatus(lead, "reserve", actor, { bookingValue: 5900 })
    expect(names(f)).toEqual(["Lead", "QualifiedLead", "Purchase"])
    const ids = events(f).map((e) => e.event_id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[1]).toBe(`qualified-${lead.id}`); expect(ids[2]).toBe(`purchase-${lead.id}`)
    expect(events(f)[2].custom_data.value).toBe(5900)
    expect(events(f)[1].custom_data).not.toHaveProperty("value")
  })

  it("sans consentement de suivi : aucun évènement du cycle (le CRM enregistre tout de même la vente)", async () => {
    const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ trackingConsent: false })))
    let lead = (await getLead(f.db.landing_leads[0].id))!
    await changeStatus(lead, "qualifie", actor); lead = (await getLead(lead.id))!
    expect(await changeStatus(lead, "reserve", actor, { bookingValue: 5900 })).toMatchObject({ ok: true, conversion: "sans consentement" })
    expect(names(f)).toEqual([])
    expect(f.db.landing_leads[0]).toMatchObject({ status: "reserve", booking_value: 5900 })
    expect(f.db.landing_leads[0].fbc ?? null).toBeNull() // pas d identifiant publicitaire stocké sans consentement
  })

  it("un lead marqué TEST ne nourrit JAMAIS Meta : ni QualifiedLead, ni Purchase (correctif de certification)", async () => {
    const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ eventId: "cert-evt-test01", phone: "98 140 515" })))
    expect(names(f)).toEqual(["Lead"])
    let lead = (await getLead(f.db.landing_leads[0].id))!
    expect(await setTestFlag(lead, true, actor)).toEqual({ ok: true }); lead = (await getLead(lead.id))!
    await changeStatus(lead, "qualifie", actor); lead = (await getLead(lead.id))!
    expect(await changeStatus(lead, "reserve", actor, { bookingValue: 99999 })).toEqual({ ok: true, conversion: null })
    expect(names(f)).toEqual(["Lead"])
    expect(f.db.landing_leads[0]).toMatchObject({ is_test: true, status: "reserve" })
  })

  it("Meta en panne : le statut est enregistré, jamais d'exception, et la vente n'est pas rejouée (limite connue : aucune relance)", async () => {
    const f = installFetchMock(); const lead = (await (async () => { await leadsPOST(post("/api/leads", mk({ eventId: "cert-evt-panne1", phone: "98 140 516" }))); return (await getLead(f.db.landing_leads[0].id))! })())
    const base = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (u: unknown, i?: RequestInit) => (String(u).includes("graph.facebook.com") ? new Response(JSON.stringify({ error: "down" }), { status: 500 }) : base(u as string, i))))
    await expect(changeStatus(lead, "reserve", actor, { bookingValue: 3000 })).resolves.toMatchObject({ ok: true })
    expect(f.db.landing_leads[0].status).toBe("reserve")
  })
})

describe("CERT P1 — parcours commercial : acquisition → qualification → devis → réservation → fidélisation → marge", () => {
  it("un prospect Facebook suivi de bout en bout : attribution, entonnoir, client Fidèle, marge confirmée exacte", async () => {
    const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk()))
    const row0 = f.db.landing_leads[0]
    // acquisition : toute l'attribution est conservée
    expect(row0).toMatchObject({ channel: "meta", utm_source: "facebook", utm_medium: "paid", utm_campaign: "omra-ramadan-2027-fb", utm_term: "tunisie-arabe-fr", utm_content: "video-omra-ramadan", region: "Tunis", first_channel: "meta", first_utm_campaign: "omra-ramadan-2027-fb", status: "nouveau" })

    let lead = (await getLead(row0.id))!
    for (const st of ["a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation"] as const) { await changeStatus(lead, st, actor); lead = (await getLead(lead.id))! }
    await changeStatus(lead, "reserve", actor, { bookingValue: 11800, purchasedProduct: "omra" }); lead = (await getLead(lead.id))!
    expect(lead).toMatchObject({ status: "reserve", booking_value: 11800, purchased_product: "omra" })
    expect(lead.booked_at).toBeTruthy()

    // entonnoir cumulatif : chaque étape comptée une fois
    const acts = f.db.landing_lead_activities as FunnelActivity[]
    const steps = Object.fromEntries(funnel([{ id: lead.id, created_at: lead.created_at, status: lead.status, booking_value: lead.booking_value, booked_at: lead.booked_at }], acts).map((s) => [s.key, s.count]))
    expect(steps).toMatchObject({ recus: 1, contactes: 1, qualifies: 1, propositions: 1, reserves: 1, gagnes: 0 })

    // fidélisation : un client « Fidèle » dès la 1re vente (le seuil VIP n'est pas défini : personne n'est VIP)
    vi.stubEnv("LANDING_VIP_THRESHOLD_TND", "")
    const customers = groupCustomers([lead])
    expect(customers).toHaveLength(1)
    expect(customers[0]).toMatchObject({ booked: 1, revenue: 11800, tier: "fidele", region: "Tunis" })

    // rentabilité : dépenses 400, commission confirmée 1 500, coût variable rattaché à la vente 100 → marge confirmée 1 000 ; une 2e commission provisoire 300
    const econLead: EconLead = { id: lead.id, created_at: lead.created_at, status: lead.status, booking_value: lead.booking_value, booked_at: lead.booked_at, channel: lead.channel, utm_campaign: lead.utm_campaign, utm_content: lead.utm_content, ad_id: lead.ad_id ?? null, product: lead.product, niche: lead.niche, region: lead.region, utm_term: "tunisie-arabe-fr" }
    const spends: SpendRow[] = [{ spend_date: "2026-11-18", network: "meta", campaign: "omra-ramadan-2027-fb", amount_tnd: 400 }]
    const commissions: CommissionRow[] = [{ lead_id: lead.id, kind: "commission", amount_tnd: 1500, status: "confirme" }, { lead_id: lead.id, kind: "commission", amount_tnd: 300, status: "provisoire" }]
    const costs: CostRow[] = [{ category: "frais_paiement", amount_tnd: 100, lead_id: lead.id, network: null, campaign: null } as CostRow]
    for (const dim of ["network", "campaign", "product", "ad", "adset", "region"] as const) {
      const r = economics({ leads: [econLead], activities: acts, spends, costs, commissions }, dim)
      expect(r.total.metrics, dim).toMatchObject({ spend: 400, leads: 1, bookings: 1, commissionConfirmed: 1500, commissionProvisional: 300, variableCosts: 100, marginConfirmed: 1000, marginWithProvisional: 1300 })
      expect(r.total.metrics.costPerBooking, dim).toBe(400)
      expect(r.winnerKey, dim).toBeNull() // un seul dossier : jamais de « gagnante » sous 5 réservations confirmées
    }
  })

  it("annulation et remboursement : la commission nette retombe, la vente n'est plus comptée, la marge reste honnête", () => {
    const l: EconLead = { id: "a", created_at: "2026-11-18T10:00:00Z", status: "perdu", booking_value: 11800, booked_at: "2026-11-20T10:00:00Z", channel: "meta", utm_campaign: "omra-ramadan-2027-fb", product: "omra", niche: null }
    const r = economics({ leads: [l], activities: [], spends: [{ spend_date: "2026-11-18", network: "meta", campaign: "omra-ramadan-2027-fb", amount_tnd: 400 }], commissions: [{ lead_id: "a", kind: "commission", amount_tnd: 1500, status: "confirme" }, { lead_id: "a", kind: "annulation", amount_tnd: -1500, status: "confirme" }] }, "network")
    expect(r.total.metrics).toMatchObject({ bookings: 0, commissionConfirmed: 0, marginConfirmed: -400 })
  })
})
