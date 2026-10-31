import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"
import { findStaff, getAuthUser, signInWithPassword } from "@/lib/server/auth"
import { configureAll, installFetchMock } from "./helpers"

const jwt = (expSecondsFromNow: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString("base64url")}.s`

function req(path: string, cookies: Record<string, string> = {}) {
  return new NextRequest(`https://landing.test${path}`, { headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") } })
}

function mockAuth(opts: { refreshOk?: boolean; userOk?: boolean } = {}) {
  const calls: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url)
    calls.push(u)
    if (u.includes("/auth/v1/token")) {
      return opts.refreshOk === false
        ? new Response("{}", { status: 400 })
        : new Response(JSON.stringify({ access_token: jwt(3600), refresh_token: "rt-new", expires_in: 3600, user: { id: "11111111-1111-1111-1111-111111111111" } }), { status: 200 })
    }
    if (u.includes("/auth/v1/user")) {
      const ok = opts.userOk !== false && String((init.headers as Record<string, string>).Authorization).startsWith("Bearer ")
      return ok ? new Response(JSON.stringify({ id: "11111111-1111-1111-1111-111111111111", email: "agent@easy2book.tn" })) : new Response("{}", { status: 401 })
    }
    return new Response("not found", { status: 404 })
  }))
  return calls
}

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
})
afterEach(() => vi.unstubAllEnvs())

describe("middleware /admin", () => {
  it("sans session : redirection vers la connexion", async () => {
    mockAuth()
    const res = await middleware(req("/admin/leads/x"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://landing.test/admin/login?next=%2Fadmin%2Fleads%2Fx")
  })

  it("la page de connexion reste accessible", async () => {
    mockAuth()
    expect((await middleware(req("/admin/login"))).headers.get("location")).toBeNull()
  })

  it("jeton valide : passe sans appel réseau", async () => {
    const calls = mockAuth()
    const res = await middleware(req("/admin", { e2b_admin_at: jwt(3600), e2b_admin_rt: "rt" }))
    expect(res.headers.get("location")).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("jeton expiré : rafraîchi et réenregistré en cookie httpOnly", async () => {
    mockAuth()
    const res = await middleware(req("/admin", { e2b_admin_at: jwt(-10), e2b_admin_rt: "rt-old" }))
    expect(res.headers.get("location")).toBeNull()
    const setCookie = res.headers.get("set-cookie") || ""
    expect(setCookie).toContain("e2b_admin_rt=rt-new")
    expect(setCookie.toLowerCase()).toContain("httponly")
  })

  it("rafraîchissement refusé : retour à la connexion et cookies effacés", async () => {
    mockAuth({ refreshOk: false })
    const res = await middleware(req("/admin", { e2b_admin_at: jwt(-10), e2b_admin_rt: "rt-old" }))
    expect(res.headers.get("location")).toContain("/admin/login")
  })
})

describe("authentification Supabase", () => {
  it("connexion et vérification du jeton via l'API Auth, avec la clé publique", async () => {
    const calls = mockAuth()
    const s = await signInWithPassword("agent@easy2book.tn", "secret")
    expect(s?.user?.id).toBe("11111111-1111-1111-1111-111111111111")
    expect(await getAuthUser(s!.access_token)).toEqual({ id: "11111111-1111-1111-1111-111111111111", email: "agent@easy2book.tn" })
    expect(calls[0]).toBe("https://landing-sb.test/auth/v1/token?grant_type=password")
  })

  it("jeton refusé par Supabase : aucun utilisateur", async () => {
    mockAuth({ userOk: false })
    expect(await getAuthUser("invalide")).toBeNull()
  })

  it("seul un membre ACTIF de landing_staff est reconnu", async () => {
    const f = installFetchMock()
    f.db.landing_staff.push({ user_id: "11111111-1111-1111-1111-111111111111", email: "agent@easy2book.tn", full_name: null, role: "agent", active: true })
    expect(await findStaff("11111111-1111-1111-1111-111111111111")).toMatchObject({ email: "agent@easy2book.tn", role: "agent" })
    expect(await findStaff("22222222-2222-2222-2222-222222222222")).toBeNull()
    expect(await findStaff("pas-un-uuid")).toBeNull()
    expect(decodeURIComponent(f.dbCalls()[0].url)).toContain("active=eq.true")
  })
})
