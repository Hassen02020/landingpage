import { describe, expect, it } from "vitest"
import { economics, type CommissionRow, type CostRow, type EconLead, type SpendRow } from "../lib/ad-economics"
import type { Status } from "../lib/status"

let n = 0
const lead = (o: Partial<EconLead> & { status?: Status } = {}): EconLead => ({
  id: o.id ?? `L${++n}`, created_at: "2026-11-02T10:00:00Z", status: o.status ?? "reserve", booking_value: null, booked_at: "2026-11-08",
  channel: "meta", utm_campaign: "Omra 2027", product: "omra", niche: "omra-ramadan", ...o,
})
const spend = (amount: number, over: Partial<SpendRow> = {}): SpendRow => ({ spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: amount, ...over })
const com = (lead_id: string, amount: number, status: "provisoire" | "confirme" = "confirme"): CommissionRow => ({ lead_id, kind: amount > 0 ? "commission" : "remboursement", amount_tnd: amount, status })
const cost = (amount: number, over: Partial<CostRow> = {}): CostRow => ({ category: "frais_paiement", amount_tnd: amount, ...over })
const run = (i: Partial<Parameters<typeof economics>[0]>, dim: Parameters<typeof economics>[1] = "campaign") =>
  economics({ leads: [], activities: [], spends: [], commissions: [], ...i }, dim)

describe("marge nette = commission nette − publicité − coûts variables", () => {
  it("1 000 de commission confirmée, 300 de pub, 100 de coûts → 600 de marge confirmée", () => {
    const l = lead()
    const m = run({ leads: [l], spends: [spend(300)], commissions: [com(l.id, 1000)], costs: [cost(100, { lead_id: l.id })] }, "network").total.metrics
    expect(m).toMatchObject({ spend: 300, variableCosts: 100, marginConfirmed: 600, marginWithProvisional: 600, result: 700 })
  })

  it("sans coût variable saisi : variableCosts = 0 (l'écran le signale), la marge ne change pas par magie", () => {
    const l = lead()
    expect(run({ leads: [l], spends: [spend(300)], commissions: [com(l.id, 1000)] }).total.metrics.variableCosts).toBe(0)
  })
})

describe("1. aucun double comptage entre réservation et campagne", () => {
  it("un coût lié à une réservation n'est compté QU'UNE fois (pas aussi dans la campagne)", () => {
    const l = lead()
    const r = run({ leads: [l], spends: [spend(300)], commissions: [com(l.id, 1000)], costs: [cost(100, { lead_id: l.id })] })
    expect(r.total.metrics.variableCosts).toBe(100)
    expect(r.rows[0].metrics.variableCosts).toBe(100)
    expect(r.rows[0].metrics.spend).toBe(300)
  })

  it("un coût qui porte réservation ET campagne : la réservation l'emporte, la campagne est ignorée", () => {
    const l = lead()
    const r = run({ leads: [l], spends: [spend(300)], commissions: [com(l.id, 1000)], costs: [cost(100, { lead_id: l.id, network: "meta", campaign: "Omra 2027" })] })
    expect(r.total.metrics.variableCosts).toBe(100)
    expect(r.rows[0].metrics.variableCosts).toBe(100)
  })

  it("un coût de campagne se répartit entre produits sans perdre ni dupliquer un millime", () => {
    const a = lead({ product: "omra" }), b = lead({ product: "turquie" }), c = lead({ product: "turquie" })
    const r = run({ leads: [a, b, c], costs: [cost(100, { network: "meta", campaign: "Omra 2027" })] }, "product")
    const sum = r.rows.reduce((s, x) => s + x.metrics.variableCosts, 0)
    expect(Math.round(sum * 1000)).toBe(100000)
    expect(r.total.metrics.variableCosts).toBe(100)
  })

  it("coût sans rattachement ou réservation inconnue : compté au total, listé « non attribué », jamais réparti", () => {
    const l = lead()
    const r = run({ leads: [l], commissions: [com(l.id, 500)], costs: [cost(40), cost(10, { lead_id: "inconnue" })] })
    expect(r.unattachedCosts).toBe(50)
    expect(r.total.metrics.variableCosts).toBe(50)
    expect(r.rows[0].metrics.variableCosts).toBe(0)
  })

  it("annulation d'un coût : somme nette ; publicité et remboursement saisis comme coûts sont écartés", () => {
    const l = lead()
    const r = run({ leads: [l], costs: [cost(100, { lead_id: l.id }), cost(-100, { lead_id: l.id, voids_id: 1 }), cost(999, { category: "publicite" }), cost(50, { category: "remboursement", lead_id: l.id })] })
    expect(r.total.metrics.variableCosts).toBe(0)
    expect(r.excludedCostRows).toBe(2)
  })
})

describe("2. remboursements : déduits une seule fois", () => {
  it("un remboursement du registre des commissions réduit la commission nette ; le geste commercial est un coût distinct", () => {
    const l = lead()
    const m = run({ leads: [l], spends: [spend(100)], commissions: [com(l.id, 1000), com(l.id, -200)], costs: [cost(30, { category: "geste_commercial", lead_id: l.id })] }, "network").total.metrics
    expect(m.commissionNet).toBe(800)
    expect(m.variableCosts).toBe(30)
    expect(m.marginConfirmed).toBe(670) // 800 − 100 − 30 : le remboursement n'est PAS retiré une 2e fois
  })

  it("saisir le même remboursement comme coût : écarté, la marge ne baisse pas deux fois", () => {
    const l = lead()
    const m = run({ leads: [l], commissions: [com(l.id, 1000), com(l.id, -200)], costs: [cost(200, { category: "remboursement", lead_id: l.id })] }, "network").total.metrics
    expect(m.marginConfirmed).toBe(800)
  })
})

describe("3. provisoire et confirmé séparés", () => {
  it("la marge confirmée ignore le provisoire ; la marge « avec provisoire » l'inclut, distinctement", () => {
    const a = lead(), b = lead()
    const m = run({ leads: [a, b], spends: [spend(200)], commissions: [com(a.id, 500, "confirme"), com(b.id, 400, "provisoire")] }, "network").total.metrics
    expect(m.marginConfirmed).toBe(300)
    expect(m.marginWithProvisional).toBe(700)
    expect(m.confirmedBookings).toBe(1)
  })
  it("ligne signalée comme contenant du provisoire", () => {
    const a = lead()
    expect(run({ leads: [a], commissions: [com(a.id, 400, "provisoire")] }).rows[0].hasProvisional).toBe(true)
  })
})

describe("4. campagne gagnante", () => {
  const camp = (name: string, count: number, comm: number, status: "provisoire" | "confirme" = "confirme") => {
    const leads = Array.from({ length: count }, () => lead({ utm_campaign: name }))
    return { leads, commissions: leads.map((l) => com(l.id, comm, status)) }
  }
  const build = (specs: { name: string; count: number; comm: number; spend: number; status?: "provisoire" | "confirme" }[], costs: CostRow[] = []) => {
    const parts = specs.map((s) => camp(s.name, s.count, s.comm, s.status))
    return run({ leads: parts.flatMap((p) => p.leads), commissions: parts.flatMap((p) => p.commissions), spends: specs.map((s) => spend(s.spend, { campaign: s.name })), costs })
  }

  it("gagnante : ≥ 5 réservations confirmées, marge confirmée > 0, strictement supérieure aux autres", () => {
    const r = build([{ name: "A", count: 5, comm: 200, spend: 300 }, { name: "B", count: 5, comm: 120, spend: 300 }])
    expect(r.rows.find((x) => x.key === r.winnerKey)?.label).toContain("A")
  })
  it("moins de 5 réservations confirmées : jamais gagnante, même très rentable", () => {
    const r = build([{ name: "A", count: 4, comm: 1000, spend: 100 }])
    expect(r.winnerKey).toBeNull()
  })
  it("5 réservations mais commissions provisoires : pas gagnante, et la raison le dit", () => {
    const r = build([{ name: "A", count: 5, comm: 500, spend: 100, status: "provisoire" }])
    expect(r.winnerKey).toBeNull()
    expect(r.winnerReason).toMatch(/provisoires/)
  })
  it("beaucoup de réservations et de chiffre d'affaires mais marge nette négative après coûts variables : pas gagnante", () => {
    const l = build([{ name: "A", count: 6, comm: 100, spend: 300 }])
    const costs = l.rows.length ? [cost(400, { network: "meta", campaign: "A" })] : []
    const r = build([{ name: "A", count: 6, comm: 100, spend: 300 }], costs)
    expect(r.rows[0].metrics.marginConfirmed).toBe(-100)
    expect(r.winnerKey).toBeNull()
  })
  it("égalité exacte de marge : pas de gagnante unique", () => {
    const r = build([{ name: "A", count: 5, comm: 200, spend: 300 }, { name: "B", count: 5, comm: 200, spend: 300 }])
    expect(r.winnerKey).toBeNull()
    expect(r.winnerReason).toMatch(/même marge/)
  })
  it("la meilleure marge gagne, pas le plus de réservations", () => {
    const r = build([{ name: "A", count: 9, comm: 100, spend: 700 }, { name: "B", count: 5, comm: 300, spend: 300 }])
    expect(r.rows.find((x) => x.key === r.winnerKey)?.label).toContain("B")
  })
})
