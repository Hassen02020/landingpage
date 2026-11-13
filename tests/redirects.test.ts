import { describe, expect, it } from "vitest"
import nextConfig from "../next.config.mjs"

describe("redirections de next.config.mjs", () => {
  it("UNE seule règle : /omra-2027 → /omra, temporaire (307), sans joker", async () => {
    const rules = await (nextConfig as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects()
    expect(rules).toEqual([{ source: "/omra-2027", destination: "/omra", permanent: false }])
  })
  it("aucun joker ni paramètre de motif ; ni /omra ni /c/omra-2027 ne sont des sources (pas de boucle, /c/omra-2027 inchangée)", async () => {
    const rules = await (nextConfig as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects()
    for (const r of rules) {
      expect(r.source).not.toMatch(/[:*()?+{}]/)
      expect(r.permanent, "pas de 308 sans nouvelle autorisation").toBe(false)
      expect(["/omra", "/c/omra-2027"]).not.toContain(r.source)
    }
  })
})
