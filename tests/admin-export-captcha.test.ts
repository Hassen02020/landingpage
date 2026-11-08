import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { verifyCaptcha } from "@/lib/server/captcha"
import { __resetGuards } from "@/lib/server/guard"
import { configureAll, installFetchMock, post } from "./helpers"

const staffMock = vi.hoisted(() => ({ current: null as null | { userId: string; email: string; fullName: null; role: "admin" | "agent"; orgRole: "admin" | "manager" | "employee" } }))
vi.mock("@/lib/server/auth", () => ({ currentStaff: async () => staffMock.current }))

beforeEach(() => {
  __resetGuards()
  configureAll()
})
afterEach(() => vi.unstubAllEnvs())

describe("GET /admin/export", () => {
  const call = async () => (await import("@/app/admin/export/route")).GET(new NextRequest("https://landing.test/admin/export"))

  it("refusé sans session (401) et pour un agent (403)", async () => {
    installFetchMock()
    staffMock.current = null
    expect((await call()).status).toBe(401)
    staffMock.current = { userId: "u", email: "agent@x.tn", fullName: null, role: "agent", orgRole: "employee" }
    expect((await call()).status).toBe(403)
  })

  it("autorisé pour un administrateur, en CSV", async () => {
    installFetchMock()
    staffMock.current = { userId: "u", email: "admin@x.tn", fullName: null, role: "admin", orgRole: "admin" }
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
  })
})

describe("captcha Turnstile", () => {
  function mockSiteverify(success: boolean) {
    const calls: string[] = []
    const base = installFetchMock()
    const inner = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("challenges.cloudflare.com")) {
        calls.push(String(init?.body))
        return new Response(JSON.stringify({ success }))
      }
      return (inner as typeof fetch)(url as string, init)
    }))
    return { calls, base }
  }

  it("inactif sans clé secrète", async () => {
    expect(await verifyCaptcha(undefined)).toBe(true)
  })

  it("actif : jeton absent refusé, jeton validé par Cloudflare accepté", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "ts-secret")
    const { calls } = mockSiteverify(true)
    expect(await verifyCaptcha(undefined)).toBe(false)
    expect(await verifyCaptcha("tok", "1.2.3.4")).toBe(true)
    expect(calls[0]).toContain("response=tok")
    expect(calls[0]).toContain("remoteip=1.2.3.4")
  })

  it("POST /api/leads : 403 si Cloudflare refuse, rien n'est enregistré", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "ts-secret")
    const { base } = mockSiteverify(false)
    const { POST } = await import("@/app/api/leads/route")
    const res = await POST(post("/api/leads", { eventId: "cap-evt-0001", name: "Sana Ben", phone: "55123456", product: "omra", contactConsent: true, captchaToken: "x" }))
    expect(res.status).toBe(403)
    expect(base.db.landing_leads).toHaveLength(0)
  })

  it("POST /api/leads : accepté si Cloudflare valide", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "ts-secret")
    const { base } = mockSiteverify(true)
    const { POST } = await import("@/app/api/leads/route")
    const res = await POST(post("/api/leads", { eventId: "cap-evt-0002", name: "Sana Ben", phone: "55123458", product: "omra", contactConsent: true, captchaToken: "ok" }))
    expect(res.status).toBe(200)
    expect(base.db.landing_leads).toHaveLength(1)
  })
})
