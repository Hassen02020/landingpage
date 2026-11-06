import { afterEach, describe, expect, it, vi } from "vitest"
import { TIER_LABELS, tierOf, vipThreshold } from "@/lib/loyalty"
import { groupCustomers } from "@/lib/server/customer"
import type { LeadRow } from "@/lib/server/crm"

afterEach(() => vi.unstubAllEnvs())

let n = 0
const lead = (o: Partial<LeadRow> = {}): LeadRow =>
  ({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, created_at: "2026-10-10T10:00:00Z", ref: `E2B-BBBB${String(n).padStart(2, "0")}`, visitor_ref: null,
    first_name: "Karim", last_name: null, phone: "21699001122", product: "omra", offer: null, niche: null, destination: null, travel_date: null, travel_period: null,
    adults: 1, children: 0, budget: null, message: null, status: "nouveau", booking_value: null, booked_at: null, notes: null, marketing_consent: true, tracking_consent: false,
    channel: null, utm_source: null, utm_campaign: null, utm_content: null, ad_id: null, landing_page: null, visitor_id: null, fbp: null, fbc: null, ttp: null, ttclid: null, ip: null, user_agent: null, ...o,
  }) as LeadRow

describe("fidélité : règles décidées (CA cumulé à vie, Fidèle / VIP)", () => {
  it("le seuil VIP n'est JAMAIS inventé : absent ou invalide → personne n'est VIP", () => {
    for (const bad of [undefined, "", "abc", "0", "-5", "NaN"]) expect(vipThreshold(bad)).toBeNull()
    expect(tierOf(5, 1_000_000, null)).toBe("fidele")
  })

  it("seuil lu depuis la variable, espaces et virgule décimale acceptés", () => {
    expect(vipThreshold("15000")).toBe(15000)
    expect(vipThreshold("15 000,50")).toBe(15000.5)
    vi.stubEnv("LANDING_VIP_THRESHOLD_TND", "10000")
    expect(vipThreshold()).toBe(10000)
  })

  it("niveaux : aucun sans vente ; Fidèle dès la 1re vente ; VIP au seuil exact (inclus)", () => {
    expect(tierOf(0, 0, 10000)).toBeNull()
    expect(tierOf(0, 50000, 10000)).toBeNull() // pas de vente = pas de niveau
    expect(tierOf(1, 9999.99, 10000)).toBe("fidele")
    expect(tierOf(1, 10000, 10000)).toBe("vip")
    expect(tierOf(3, 30000, 10000)).toBe("vip")
    expect(TIER_LABELS).toEqual({ vip: "VIP", fidele: "Fidèle" })
  })

  it("cumul À VIE sur toutes les demandes d'un client ; réservé + gagné ; un perdu ne compte pas", () => {
    vi.stubEnv("LANDING_VIP_THRESHOLD_TND", "10000")
    const [c] = groupCustomers([
      lead({ status: "gagne", booking_value: 6000, booked_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" }), // très ancien : compte quand même
      lead({ status: "reserve", booking_value: 4000, booked_at: "2026-10-01T00:00:00Z" }),
      lead({ status: "perdu", booking_value: 99999 }),
    ])
    expect(c.revenue).toBe(10000)
    expect(c.tier).toBe("vip")
  })

  it("sous le seuil : Fidèle ; sans seuil défini : Fidèle (jamais VIP)", () => {
    vi.stubEnv("LANDING_VIP_THRESHOLD_TND", "10000")
    expect(groupCustomers([lead({ status: "reserve", booking_value: 9000, booked_at: "2026-10-01T00:00:00Z" })])[0].tier).toBe("fidele")
    vi.stubEnv("LANDING_VIP_THRESHOLD_TND", "")
    expect(groupCustomers([lead({ status: "reserve", booking_value: 900000, booked_at: "2026-10-01T00:00:00Z" })])[0].tier).toBe("fidele")
  })

  it("client sans vente : aucun niveau", () => {
    expect(groupCustomers([lead(), lead({ status: "negociation" })])[0].tier).toBeNull()
  })
})
