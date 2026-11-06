import { afterEach, describe, expect, it, vi } from "vitest"
import { buildProfile, groupCustomers, loadCustomer, mergeTimeline } from "@/lib/server/customer"
import type { Activity, LeadRow } from "@/lib/server/crm"
import { configureAll, installFetchMock } from "./helpers"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

let n = 0
const lead = (o: Partial<LeadRow> = {}): LeadRow =>
  ({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, created_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`, ref: `E2B-AAAA${String(n).padStart(2, "0")}`,
    visitor_ref: null, first_name: "Ahmed", last_name: "Ben Ali", phone: "21698140514", product: "omra", offer: null, niche: null, destination: null, travel_date: null,
    travel_period: null, adults: 1, children: 0, budget: null, message: null, status: "nouveau", booking_value: null, booked_at: null, notes: null,
    marketing_consent: true, tracking_consent: false, channel: "meta", utm_source: null, utm_campaign: null, utm_content: null, ad_id: null, landing_page: null,
    visitor_id: null, fbp: null, fbc: null, ttp: null, ttclid: null, ip: null, user_agent: null, ...o,
  }) as LeadRow
const act = (lead_id: string, id: number, created_at: string, o: Partial<Activity> = {}) =>
  ({ id, lead_id, created_at, actor_label: "agent", type: "note", from_status: null, to_status: null, body: null, ...o }) as Activity & { lead_id: string }

describe("Customer 360 : regroupement", () => {
  it("deux demandes du même téléphone forment UN client ; un autre numéro un autre client", () => {
    const c = groupCustomers([lead(), lead({ product: "voyage" }), lead({ phone: "21622123456", first_name: "Fatma" })])
    expect(c).toHaveLength(2)
    const a = c.find((x) => x.phone === "21698140514")!
    expect(a.leads).toBe(2)
    expect(a.products.sort()).toEqual(["omra", "voyage"])
  })

  it("ventes = réservé + gagné ; réservé puis gagné d'une demande ne compte qu'une vente et un montant", () => {
    const [c] = groupCustomers([
      lead({ status: "gagne", booking_value: 9000, booked_at: "2026-10-01T00:00:00Z" }),
      lead({ status: "reserve", booking_value: 4000, booked_at: "2026-10-02T00:00:00Z" }),
      lead({ status: "negociation" }),
      lead({ status: "perdu" }),
    ])
    expect(c.booked).toBe(2)
    expect(c.revenue).toBe(13000)
    expect(c.openLeads).toBe(1)
  })

  it("un retrait de consentement marketing sur UNE demande exclut le client du marketing", () => {
    expect(groupCustomers([lead(), lead()])[0].marketingOk).toBe(true)
    expect(groupCustomers([lead(), lead({ marketing_withdrawn_at: "2026-10-20T00:00:00Z" })])[0].marketingOk).toBe(false)
    expect(groupCustomers([lead(), lead({ marketing_consent: false })])[0].marketingOk).toBe(false)
  })

  it("les dossiers anonymisés ou sans téléphone valide ne forment pas de client", () => {
    expect(groupCustomers([lead({ anonymized_at: "2026-10-01T00:00:00Z" }), lead({ phone: null }), lead({ phone: "abc" })])).toEqual([])
  })

  it("le nom affiché est celui de la demande la plus récente", () => {
    const [c] = groupCustomers([lead({ first_name: "Ancien", created_at: "2026-01-01T00:00:00Z" }), lead({ first_name: "Récent", created_at: "2026-09-01T00:00:00Z" })])
    expect(c.name.startsWith("Récent")).toBe(true)
  })
})

describe("Customer 360 : chronologie et profil", () => {
  it("fusionne les activités de toutes les demandes, du plus récent au plus ancien, et ignore celles d'un autre lead", () => {
    const a = lead(), b = lead()
    const t = mergeTimeline([a, b], [
      act(a.id, 1, "2026-10-01T10:00:00Z"), act(b.id, 2, "2026-10-03T10:00:00Z"), act(a.id, 3, "2026-10-02T10:00:00Z"), act("ffffffff-0000-4000-8000-000000000000", 4, "2026-10-09T10:00:00Z"),
    ])
    expect(t.map((x) => x.id)).toEqual([2, 3, 1])
    expect(t[0].lead_ref).toBe(b.ref)
  })

  it("profil : e-mail / région les plus récents renseignés, WhatsApp reçus / envoyés comptés, null si aucun lead", () => {
    const a = lead({ created_at: "2026-09-01T00:00:00Z", email: "ancien@x.tn" }), b = lead({ created_at: "2026-10-01T00:00:00Z", region: "Sfax" })
    const p = buildProfile("21698140514", [a, b], [act(a.id, 1, "2026-09-02T00:00:00Z", { type: "wa_in" }), act(b.id, 2, "2026-10-02T00:00:00Z", { type: "wa_out" }), act(b.id, 3, "2026-10-03T00:00:00Z", { type: "wa_out" })])!
    expect(p.email).toBe("ancien@x.tn")
    expect(p.region).toBe("Sfax")
    expect(p.whatsapp).toEqual({ received: 1, sent: 2 })
    expect(p.leads[0].id).toBe(b.id)
    expect(buildProfile("21611111111", [a, b], [])).toBeNull()
  })

  it("loadCustomer refuse une clé qui n'est pas un téléphone (aucune requête envoyée)", async () => {
    configureAll()
    const calls = installFetchMock().calls
    expect(await loadCustomer("1;drop")).toBeNull()
    expect(await loadCustomer("abc")).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
