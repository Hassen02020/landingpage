import { afterEach, describe, expect, it, vi } from "vitest"
import { isAllowedOrigin } from "@/lib/server/guard"

const h = (o: Record<string, string>) => new Headers(o)
afterEach(() => vi.unstubAllEnvs())

describe("isAllowedOrigin", () => {
  it("accepte le même hôte et l'absence d'Origin", () => {
    expect(isAllowedOrigin(h({ host: "a.test", origin: "https://a.test" }))).toBe(true)
    expect(isAllowedOrigin(h({ host: "a.test" }))).toBe(true)
  })
  it("refuse un autre site ou une Origin invalide", () => {
    expect(isAllowedOrigin(h({ host: "a.test", origin: "https://b.test" }))).toBe(false)
    expect(isAllowedOrigin(h({ host: "a.test", origin: "null" }))).toBe(false)
  })
  it("accepte les domaines listés dans ALLOWED_ORIGINS", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://www.easy2book.tn, https://b.test")
    expect(isAllowedOrigin(h({ host: "a.test", origin: "https://b.test" }))).toBe(true)
  })
})
