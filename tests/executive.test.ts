import { describe, it, expect } from "vitest"
import { executiveAnswers } from "@/lib/executive"
import type { EconomicsResult, GroupRow, Metrics } from "@/lib/ad-economics"

const metrics = (o: Partial<Metrics> = {}): Metrics => ({
  spend: 0, leads: 0, qualified: 0, quotes: 0, bookings: 0, commissionConfirmed: 0, commissionProvisional: 0, commissionNet: 0, result: 0, variableCosts: 0,
  confirmedBookings: 0, bookingsWithoutCommission: 0, marginConfirmed: 0, marginWithProvisional: 0, profitabilityPct: null, cpl: null, costPerQualified: null,
  costPerQuote: null, costPerBooking: null, qualificationRate: null, quoteRate: null, bookingRate: null, ...o,
})
const row = (key: string, m: Partial<Metrics> = {}, extra: Partial<GroupRow> = {}): GroupRow => ({ key, label: key, metrics: metrics(m), spendBasis: "exacte", costBasis: "exacte", sufficient: true, hasProvisional: false, ...extra })
const econ = (o: Partial<EconomicsResult> & { total?: GroupRow } = {}): EconomicsResult => ({
  rows: [], total: row("total"), unattachedSpend: [], unattachedCosts: 0, excludedCostRows: 0, winnerKey: null, winnerReason: "Aucune gagnante : aucune dépense enregistrée.", ...o,
})
const get = (a: ReturnType<typeof executiveAnswers>, n: number) => a.find((x) => x.n === n)!

describe("tableau dirigeant : les cinq questions", () => {
  it("répond toujours aux cinq questions, dans l'ordre", () => {
    expect(executiveAnswers({ leads: 0, qualified: 0, bookings: 0, finance: null }).map((a) => a.n)).toEqual([1, 2, 3, 4, 5])
  })

  it("sans droit financier : dépenses, gain et campagne sont indisponibles, mais qualifiés et réservés restent lisibles", () => {
    const a = executiveAnswers({ leads: 7, qualified: 2, bookings: 1, finance: null })
    for (const n of [1, 4, 5]) expect(get(a, n).reliability).toBe("indisponible")
    expect(get(a, 2).value).toBe("2 sur 7")
    expect(get(a, 3).value).toBe("1")
  })

  it("aucune dépense saisie : pas de montant inventé, la page dit quoi faire", () => {
    const a = executiveAnswers({ leads: 7, qualified: 0, bookings: 0, finance: econ() })
    expect(get(a, 1).value).toBe("—")
    expect(get(a, 1).reliability).toBe("indisponible")
    expect(get(a, 1).note).toMatch(/Rentabilité/)
  })

  it("dépense rattachée : chiffre exact ; dépense sans lead rattaché : chiffre partiel", () => {
    const ok = executiveAnswers({ leads: 10, qualified: 3, bookings: 0, finance: econ({ total: row("t", { spend: 200, cpl: 20 }) }) })
    expect(get(ok, 1).reliability).toBe("exacte")
    expect(get(ok, 1).note).toMatch(/20/)
    const partial = executiveAnswers({ leads: 10, qualified: 3, bookings: 0, finance: econ({ total: row("t", { spend: 200 }), unattachedSpend: [{ network: "meta", campaign: "x", amount: 50 }] }) })
    expect(get(partial, 1).reliability).toBe("partielle")
  })

  it("zéro lead ou zéro réservation : jamais présenté comme un résultat", () => {
    const none = executiveAnswers({ leads: 0, qualified: 0, bookings: 0, finance: null })
    expect(get(none, 2).reliability).toBe("indisponible")
    expect(get(none, 3).reliability).toBe("indisponible")
    const noBooking = executiveAnswers({ leads: 7, qualified: 0, bookings: 0, finance: econ() })
    expect(get(noBooking, 3).value).toBe("0")
    expect(get(noBooking, 4).reliability).toBe("indisponible")
  })

  it("gain réel : partiel tant que des réservations n'ont pas de commission importée, provisoires jamais comptés", () => {
    const a = executiveAnswers({ leads: 10, qualified: 5, bookings: 3, finance: econ({ total: row("t", { spend: 100, marginConfirmed: 400, commissionConfirmed: 500, bookingsWithoutCommission: 1, commissionProvisional: 300 }) }) })
    expect(get(a, 4).reliability).toBe("partielle")
    expect(get(a, 4).note).toMatch(/1 réservation/)
    expect(get(a, 4).note).toMatch(/provisoires non comptés/)
    const full = executiveAnswers({ leads: 10, qualified: 5, bookings: 3, finance: econ({ total: row("t", { spend: 100, marginConfirmed: 400, commissionConfirmed: 500 }) }) })
    expect(get(full, 4).reliability).toBe("exacte")
  })

  it("campagne à financer : aucune sans gagnante validée par le moteur ; sinon la gagnante exacte", () => {
    const none = executiveAnswers({ leads: 7, qualified: 1, bookings: 1, finance: econ() })
    expect(get(none, 5).value).toBe("Aucune pour l'instant")
    expect(get(none, 5).reliability).toBe("indisponible")
    const w = row("omra-ramadan-2027-fb", { spend: 100, marginConfirmed: 900 })
    const win = executiveAnswers({ leads: 30, qualified: 12, bookings: 6, finance: econ({ rows: [w], winnerKey: "omra-ramadan-2027-fb", winnerReason: "Marge nette confirmée la plus élevée." }) })
    expect(get(win, 5).value).toBe("omra-ramadan-2027-fb")
    expect(get(win, 5).reliability).toBe("exacte")
  })
})
