import { describe, expect, it, vi } from "vitest"
import { checkDestination, checkOrigin } from "../lib/server/link-check"

const ORIGIN = "https://site.test"
const ALLOWED = ["/", "/omra", "/c/turquie-ete"]
const res = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) }) as unknown as Response

describe("vérification réelle d'une destination", () => {
  it("200 → prête ; la requête ne suit PAS les redirections, n'envoie aucun cookie et a un délai", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(200))
    const r = await checkDestination("/c/turquie-ete", ALLOWED, { origin: ORIGIN, fetchImpl: f as unknown as typeof fetch })
    expect(r).toMatchObject({ state: "ok", status: 200, checkedUrl: `${ORIGIN}/c/turquie-ete` })
    const init = f.mock.calls[0][1] as RequestInit
    expect(init.redirect).toBe("manual"); expect(init.method).toBe("GET"); expect(init.signal).toBeTruthy()
    expect(JSON.stringify(init.headers)).not.toMatch(/cookie|authorization/i)
  })
  it("redirection (307) → pas prête, avec la cible ; 404 → introuvable ; 500 → erreur ; autre code → erreur explicite", async () => {
    const mk = (r: Response) => checkDestination("/omra", ALLOWED, { origin: ORIGIN, fetchImpl: (async () => r) as unknown as typeof fetch })
    expect(await mk(res(307, { location: "/voyages-organises" }))).toMatchObject({ state: "redirect", status: 307, location: "/voyages-organises" })
    expect((await mk(res(404))).state).toBe("not_found")
    expect((await mk(res(503))).state).toBe("error")
    expect(await mk(res(403))).toMatchObject({ state: "error", message: expect.stringMatching(/403/) })
  })
  it("délai dépassé ou réseau en panne → « non vérifié » (jamais « indisponible » ni « prête »)", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" })
    expect((await checkDestination("/", ALLOWED, { origin: ORIGIN, fetchImpl: (async () => { throw timeout }) as unknown as typeof fetch })).state).toBe("timeout")
    expect((await checkDestination("/", ALLOWED, { origin: ORIGIN, fetchImpl: (async () => { throw new TypeError("fetch failed") }) as unknown as typeof fetch })).state).toBe("unverified")
  })
  it("destination hors liste, adresse libre, // ou caractères spéciaux : REFUSÉE, aucune requête envoyée", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(200))
    for (const p of ["/admin", "https://evil.test/", "//evil.test", "/c/../admin", "/omra?x=1", "/omra#a", "/a b", ""]) {
      expect((await checkDestination(p, ALLOWED, { origin: ORIGIN, fetchImpl: f as unknown as typeof fetch })).state, p).toBe("refused")
    }
    expect(f).not.toHaveBeenCalled()
  })
  it("origine : le site public, surchargeable côté serveur pour les essais locaux", () => {
    vi.stubEnv("LANDING_LINK_CHECK_ORIGIN", "http://localhost:3458/")
    expect(checkOrigin()).toBe("http://localhost:3458")
    vi.unstubAllEnvs()
    expect(checkOrigin()).toMatch(/^https?:\/\//)
  })
})
