// Route d'exécution de la publication programmée : échec fermé sans secret, refus sans en-tête exact, exécution seulement avec le bon secret.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const run = vi.fn(async () => ({ available: true, published: 2, unpublished: 1, cleared: 0, blocked: [{ id: "x", reason: "incomplète" }] }))
vi.mock("@/lib/server/page-schedule", () => ({ runDueSchedules: () => run() }))
vi.mock("@/lib/server/db", () => ({ withPublicOrg: (fn: () => unknown) => fn() }))

let GET: typeof import("@/app/api/cron/publish-scheduled/route").GET
const req = (auth?: string) => new Request("https://x.test/api/cron/publish-scheduled", { headers: auth ? { authorization: auth } : {} })
const SECRET = "un-secret-de-test-assez-long-0123456789"
beforeEach(async () => { run.mockClear(); vi.stubEnv("CRON_SECRET", SECRET); GET = (await import("@/app/api/cron/publish-scheduled/route")).GET })
afterEach(() => vi.unstubAllEnvs())

describe("/api/cron/publish-scheduled", () => {
  it("variable absente ou trop courte : 503, RIEN n'est exécuté (échec fermé), même avec un en-tête", async () => {
    for (const v of ["", "court"]) { vi.stubEnv("CRON_SECRET", v); const r = await GET(req(`Bearer ${v}`)); expect(r.status).toBe(503) }
    expect(run).not.toHaveBeenCalled()
  })
  it("en-tête absent, faux, ou schéma incorrect : 401, rien n'est exécuté", async () => {
    for (const a of [undefined, "Bearer faux", `Basic ${SECRET}`, SECRET, `Bearer ${SECRET}x`, "Bearer "]) expect((await GET(req(a))).status, String(a)).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })
  it("bon secret : exécution ; seuls des COMPTEURS sont renvoyés (aucun identifiant de page ni motif) ; jamais mis en cache", async () => {
    const r = await GET(req(`Bearer ${SECRET}`))
    expect(r.status).toBe(200); expect(run).toHaveBeenCalledTimes(1)
    expect(await r.json()).toEqual({ ok: true, available: true, published: 2, unpublished: 1, cleared: 0, blocked: 1 })
    expect(r.headers.get("cache-control")).toBe("no-store")
  })
  it("erreur interne : 500 sans détail technique", async () => {
    run.mockRejectedValueOnce(new Error("secret-interne PGRST000"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const r = await GET(req(`Bearer ${SECRET}`)); const body = JSON.stringify(await r.json())
    expect(r.status).toBe(500); expect(body).not.toContain("secret-interne"); expect(body).not.toContain("PGRST000")
    spy.mockRestore()
  })
})

describe("cron Vercel (vercel.json)", () => {
  it("déclare EXACTEMENT les deux tâches connues (publication programmée, relance des conversions), chacune avec une fréquence valide (5 champs) ; aucune autre", async () => {
    const { readFileSync } = await import("node:fs")
    const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { crons?: { path: string; schedule: string }[] }
    expect(cfg.crons!.map((c) => c.path).sort()).toEqual(["/api/cron/publish-scheduled", "/api/cron/retry-conversions"])
    for (const c of cfg.crons!) expect(c.schedule.trim().split(/\s+/)).toHaveLength(5)
    // offre Vercel Hobby : au plus 2 tâches, au plus une fois par jour (le jour et l'heure sont fixes, pas de « * » dans l'heure)
    expect(cfg.crons!.length).toBeLessThanOrEqual(2)
    for (const c of cfg.crons!) expect(c.schedule.trim().split(/\s+/)[1]).toMatch(/^\d+$/)
  })
})
