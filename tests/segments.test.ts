import { describe, expect, it } from "vitest"
import { SEGMENTS, evaluate, getSegment } from "@/lib/segments"
import type { CustomerSummary } from "@/lib/server/customer"

const NOW = Date.parse("2026-11-05T12:00:00Z")
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString()
let n = 0
const cust = (o: Partial<CustomerSummary> = {}): CustomerSummary => ({
  phone: `2169800${String(++n).padStart(4, "0")}`, name: "X", leads: 1, openLeads: 0, booked: 0, revenue: 0, lastActivityAt: ago(1), firstSeenAt: ago(30),
  products: ["omra"], channels: ["meta"], region: null, marketingOk: true, lastStatus: "nouveau", tier: null, ...o,
})
const members = (res: ReturnType<typeof evaluate>, slug: string) => res.find((r) => r.segment.slug === slug)!

describe("segments : règles", () => {
  it("slugs uniques et types connus", () => {
    expect(new Set(SEGMENTS.map((s) => s.slug)).size).toBe(SEGMENTS.length)
    expect(SEGMENTS.every((s) => s.kind === "suivi" || s.kind === "marketing")).toBe(true)
    expect(getSegment("nimporte")).toBeUndefined()
  })

  it("« à traiter » : nouveau / à contacter seulement ; « relance 7 j » : en cours et inactif ≥ 7 jours", () => {
    const res = evaluate([
      cust({ openLeads: 1, lastStatus: "a_contacter" }),
      cust({ openLeads: 1, lastStatus: "contacte", lastActivityAt: ago(8) }),
      cust({ openLeads: 1, lastStatus: "contacte", lastActivityAt: ago(6) }),
      cust({ openLeads: 0, lastStatus: "perdu", lastActivityAt: ago(90) }),
    ], NOW)
    expect(members(res, "a-traiter").members).toHaveLength(1)
    expect(members(res, "relance-7j").members).toHaveLength(1)
  })

  it("proposition sans réponse : devis / négociation inactifs depuis 7 jours", () => {
    const res = evaluate([cust({ openLeads: 1, lastStatus: "devis", lastActivityAt: ago(7) }), cust({ openLeads: 1, lastStatus: "negociation", lastActivityAt: ago(2) }), cust({ openLeads: 1, lastStatus: "qualifie", lastActivityAt: ago(30) })], NOW)
    expect(members(res, "proposition-silencieuse").members).toHaveLength(1)
  })

  it("MARKETING : un client sans consentement marketing est exclu et compté comme exclu ; jamais dans la liste contactable", () => {
    const res = evaluate([
      cust({ lastStatus: "perdu", lastActivityAt: ago(70), marketingOk: true }),
      cust({ lastStatus: "perdu", lastActivityAt: ago(70), marketingOk: false }),
      cust({ booked: 1, marketingOk: false, lastStatus: "reserve" }),
      cust({ booked: 1, marketingOk: true, lastStatus: "gagne" }),
    ], NOW)
    const lost = members(res, "perdus-recuperables")
    expect(lost.members).toHaveLength(2)
    expect(lost.eligible).toHaveLength(1)
    expect(lost.excluded).toBe(1)
    expect(lost.eligible.every((c) => c.marketingOk)).toBe(true)
    const booked = members(res, "clients-reserves")
    expect(booked.eligible).toHaveLength(1)
    expect(booked.excluded).toBe(1)
  })

  it("SUIVI : le suivi d'une demande en cours ne dépend pas du consentement marketing", () => {
    const res = evaluate([cust({ openLeads: 1, lastStatus: "nouveau", marketingOk: false })], NOW)
    const t = members(res, "a-traiter")
    expect(t.eligible).toHaveLength(1)
    expect(t.excluded).toBe(0)
  })

  it("Omra sans réservation : exclut les clients qui ont réservé ou qui ont une demande en cours", () => {
    const res = evaluate([cust(), cust({ booked: 1 }), cust({ openLeads: 1, lastStatus: "contacte" }), cust({ products: ["hotel"] })], NOW)
    expect(members(res, "omra-sans-reservation").members).toHaveLength(1)
  })

  it("segment VIP : seulement les clients VIP, avec exclusion sans consentement marketing", () => {
    const res = evaluate([cust({ tier: "vip", booked: 2, marketingOk: true }), cust({ tier: "vip", booked: 1, marketingOk: false }), cust({ tier: "fidele", booked: 1 }), cust()], NOW)
    const vip = members(res, "vip")
    expect(vip.members).toHaveLength(2)
    expect(vip.eligible).toHaveLength(1)
    expect(vip.excluded).toBe(1)
    expect(vip.segment.kind).toBe("marketing")
  })

  it("un segment vide ne plante pas", () => {
    for (const r of evaluate([], NOW)) expect(r.members).toEqual([])
  })
})
