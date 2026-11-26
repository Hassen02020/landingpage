import { describe, expect, it } from "vitest"
import { rates, ratio, teamStats, totals, type LeadStatRow } from "@/lib/server/stats"
import { pageStats } from "@/lib/page-builder/stats"

const L = (o: Partial<LeadStatRow> = {}): LeadStatRow => ({ id: Math.random().toString(), status: "nouveau", channel: null, utm_source: null, utm_campaign: null, utm_content: null, campaign_id: null, adset_id: null, ad_id: null, booking_value: null, assigned_to: null, ...o }) as LeadStatRow

describe("taux « non calculable » (L1)", () => {
  it("ratio : dénominateur 0 → null ; numérateur 0 avec dénominateur > 0 → 0 (vrai zéro)", () => {
    expect(ratio(0, 0)).toBeNull()
    expect(ratio(3, 0)).toBeNull()
    expect(ratio(0, 40)).toBe(0)
    expect(ratio(1, 4)).toBe(0.25)
  })

  it("aucun lead : tous les taux et le panier moyen sont non calculables, jamais 0", () => {
    const r = rates(totals([]))
    expect(r.treatmentRate).toBeNull()
    expect(r.bookingRate).toBeNull()
    expect(r.closingRate).toBeNull()
    expect(r.avgBasket).toBeNull()
  })

  it("0 vente sur 40 leads : taux de réservation = 0 % (vrai zéro), conclusion et panier non calculables", () => {
    const rows = Array.from({ length: 40 }, () => L({ status: "contacte" }))
    const r = rates(totals(rows))
    expect(r.bookingRate).toBe(0)
    expect(r.treatmentRate).toBe(1)
    expect(r.closingRate).toBeNull() // aucun dossier conclu
    expect(r.avgBasket).toBeNull() // aucune vente
  })

  it("valeurs inchangées quand les données existent (non-régression)", () => {
    const rows = [L({ status: "reserve", booking_value: 11000 }), L({ status: "perdu" }), L({ status: "nouveau" }), L({ status: "contacte" })]
    const r = rates(totals(rows))
    expect(r.treatmentRate).toBe(0.75)
    expect(r.closingRate).toBe(0.5)
    expect(r.bookingRate).toBe(0.25)
    expect(r.avgBasket).toBe(11000)
  })

  it("équipe : taux de conclusion non calculable tant qu'aucun dossier n'est conclu", () => {
    const staff = [{ user_id: "u1", email: "a@e.tn", full_name: "Agent A", role: "agent" as const, active: true }]
    const t = teamStats(staff, [], [L({ status: "contacte", assigned_to: "u1" })])[0]
    expect(t.closingRate).toBeNull()
  })
})

describe("libellé des réservations (L1)", () => {
  it("page Créateur : « Réservations à commission confirmée » (plus « Réservations confirmées »), valeur inchangée", () => {
    const cards = pageStats({ metrics: null, spendBasis: "aucune", ledgerAvailable: true, consentingVisitors: 0 })
    const card = cards.find((c) => c.id === "reservations")!
    expect(card.label).toBe("Réservations à commission confirmée")
    expect(card.value).toBe(0)
    expect(cards.some((c) => c.label === "Réservations confirmées")).toBe(false)
  })
})
