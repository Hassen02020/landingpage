import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PublicDataUnavailable, logDbUnavailable, unavailable } from "../lib/server/public-errors"

let lines: string[]
beforeEach(() => { lines = []; vi.spyOn(console, "error").mockImplementation((m: unknown) => { lines.push(String(m)) }) })
afterEach(() => vi.restoreAllMocks())

describe("PublicDataUnavailable et journal structuré DB_UNAVAILABLE", () => {
  it("erreur dédiée : nom, route et raison portés, distincte de toute autre erreur", () => {
    const e = new PublicDataUnavailable("/c/[slug]", "db_error")
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe("PublicDataUnavailable")
    expect([e.route, e.reason]).toEqual(["/c/[slug]", "db_error"])
  })
  it("une seule ligne JSON : event, route, raison, horodatage ; slug conforme conservé", () => {
    logDbUnavailable("/c/[slug]", "db_not_configured", "omra-ramadan-2027")
    expect(lines).toHaveLength(1)
    const j = JSON.parse(lines[0])
    expect(j).toMatchObject({ event: "DB_UNAVAILABLE", route: "/c/[slug]", reason: "db_not_configured", slug: "omra-ramadan-2027" })
    expect(Number.isNaN(Date.parse(j.at))).toBe(false)
  })
  it("slug hostile (retour à la ligne, injection, trop long, majuscules) : jamais journalisé", () => {
    for (const bad of ["a\nDB_UNAVAILABLE fake", "../../etc/passwd", "x".repeat(200), "Majuscule", "a b", "é", ""]) {
      lines = []
      logDbUnavailable("/o/[slug]", "db_error", bad)
      expect(lines).toHaveLength(1)
      expect(lines[0]).not.toContain("\n")
      expect(JSON.parse(lines[0])).not.toHaveProperty("slug")
    }
  })
  it("unavailable() journalise PUIS renvoie l'erreur à lever", () => {
    const e = unavailable("/o/[slug]", "db_error", "acme")
    expect(e).toBeInstanceOf(PublicDataUnavailable)
    expect(lines).toHaveLength(1)
  })
  it("aucune donnée personnelle ni détail technique dans le journal", () => {
    logDbUnavailable("/c/[slug]", "db_error", "ok")
    expect(Object.keys(JSON.parse(lines[0])).sort()).toEqual(["at", "event", "reason", "route", "slug"])
  })
})
