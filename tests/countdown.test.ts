import { describe, expect, it } from "vitest"
import { endOfMonthTunis } from "@/app/summer-vibes/components/CountdownTimer"

// « Promo du mois » : le compte à rebours vise la fin du mois en cours à Tunis (UTC+1) : 23:59:59 locale = 22:59:59 UTC.
describe("fin du mois à Tunis", () => {
  it("milieu de mois", () => {
    expect(endOfMonthTunis(new Date("2026-11-09T10:00:00Z"))).toBe(Date.UTC(2026, 10, 30, 22, 59, 59))
    expect(endOfMonthTunis(new Date("2026-12-15T08:00:00Z"))).toBe(Date.UTC(2026, 11, 31, 22, 59, 59))
  })
  it("passage à minuit heure de Tunis : 23:30 UTC le 30 novembre est déjà le 1er décembre à Tunis", () => {
    expect(endOfMonthTunis(new Date("2026-11-30T23:30:00Z"))).toBe(Date.UTC(2026, 11, 31, 22, 59, 59))
    expect(endOfMonthTunis(new Date("2026-11-30T22:30:00Z"))).toBe(Date.UTC(2026, 10, 30, 22, 59, 59))
  })
  it("fin d'année et février", () => {
    expect(endOfMonthTunis(new Date("2026-12-31T12:00:00Z"))).toBe(Date.UTC(2026, 11, 31, 22, 59, 59))
    expect(endOfMonthTunis(new Date("2027-02-10T12:00:00Z"))).toBe(Date.UTC(2027, 1, 28, 22, 59, 59))
  })
  it("toujours dans le futur", () => {
    const now = new Date("2026-11-09T10:00:00Z")
    expect(endOfMonthTunis(now)).toBeGreaterThan(now.getTime())
  })
})
