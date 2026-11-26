import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// cookies() de Next : jeton de session simulé
const cookieState = vi.hoisted(() => ({ token: undefined as string | undefined, outsideRequest: false }))
vi.mock("next/headers", () => ({
  cookies: () => {
    if (cookieState.outsideRequest) throw new Error("hors requête")
    return { get: (k: string) => (k === "e2b_admin_at" && cookieState.token ? { value: cookieState.token } : undefined) }
  },
}))

import { resetPublicOrgCache, resetTenantModeCache, runUnscopedLeads, select, update, withPublicOrg } from "@/lib/server/db"
import { resetSessionOrgCache } from "@/lib/server/session-org"
import { configureAll, DB_URL } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01" // organisation du site public (slug easy2book)
const BOB = "00000000-0000-4000-8000-0000000000b0"
const USER_E2B = "11111111-1111-4111-8111-111111111111"
const USER_BOB = "22222222-2222-4222-8222-222222222222"
const USER_NONE = "33333333-3333-4333-8333-333333333333"

interface World {
  orgs: { id: string; slug: string; status: string }[]
  members: { user_id: string; organization_id: string; role: string; active: boolean }[]
  tokens: Record<string, string> // jeton → user id
  organizationsStatus?: number
}
const data: { url: string; method: string; init: any }[] = []
let authCalls = 0
const probeInits: any[] = []

function world(w: World) {
  data.length = 0
  authCalls = 0
  probeInits.length = 0
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: any = {}) => {
    const u = String(url)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (u.includes("/auth/v1/user")) {
      authCalls++
      const t = String(init.headers?.Authorization ?? "").replace("Bearer ", "")
      return w.tokens[t] ? json({ id: w.tokens[t], email: "x@x.tn" }) : json({}, 401)
    }
    const dec = decodeURIComponent(u)
    if (dec.includes("/rest/v1/organizations?")) {
      if (w.organizationsStatus) return json({ code: "PGRST205" }, w.organizationsStatus)
      if (dec.includes("limit=2") && dec.includes("select=id") && !dec.includes("slug=") && !dec.includes("status=")) {
        probeInits.push(init)
        return json(w.orgs.map((o) => ({ id: o.id })))
      }
      if (dec.includes("slug=eq.easy2book")) return json(w.orgs.filter((o) => o.slug === "easy2book").map((o) => ({ id: o.id })))
      if (dec.includes("status=eq.active")) {
        const ids = (dec.match(/id=in\.\(([^)]*)\)/)?.[1] ?? "").split(",")
        return json(w.orgs.filter((o) => o.status === "active" && ids.includes(o.id)).map((o) => ({ id: o.id })))
      }
    }
    if (dec.includes("/rest/v1/organization_members?")) {
      const uid = dec.match(/user_id=eq\.([0-9a-f-]+)/)?.[1]
      return json(w.members.filter((m) => m.user_id === uid && m.active))
    }
    data.push({ url: dec, method: (init.method || "GET").toUpperCase(), init })
    return json([])
  }))
}

const EMP = "44444444-4444-4444-8444-444444444444"
const WORLD: World = {
  orgs: [{ id: E2B, slug: "easy2book", status: "active" }, { id: BOB, slug: "bob", status: "active" }],
  members: [
    { user_id: USER_E2B, organization_id: E2B, role: "admin", active: true },
    { user_id: EMP, organization_id: E2B, role: "employee", active: true },
    { user_id: USER_BOB, organization_id: BOB, role: "manager", active: true },
  ],
  tokens: { "tok-admin": USER_E2B, "tok-emp": EMP, "tok-mgr": USER_BOB },
}

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  resetTenantModeCache()
  resetPublicOrgCache()
  resetSessionOrgCache()
  cookieState.token = undefined
  cookieState.outsideRequest = false
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// L3 (décision Q8-A) : la restriction « dossiers actuellement affectés » est posée côté serveur, dans db.ts, pour TOUTE lecture de leads.
describe("L3 : un employé ne lit et ne modifie que ses dossiers affectés (restriction serveur)", () => {
  it("lecture de leads par un employé : filtre assigned_to = lui-même, en plus de l'organisation", async () => {
    world(WORLD)
    cookieState.token = "tok-emp"
    await select("landing_leads", "select=*&order=created_at.desc")
    const url = data.at(-1)!.url
    expect(url).toContain(`organization_id=eq.${E2B}`)
    expect(url).toContain(`assigned_to=eq.${EMP}`)
  })
  it("un filtre « assigned_to » de l'appelant (ex. non assignés, ou un collègue) ne peut que réduire : le filtre de l'employé reste présent", async () => {
    world(WORLD)
    cookieState.token = "tok-emp"
    await select("landing_leads", `select=*&assigned_to=is.null`)
    expect(data.at(-1)!.url).toContain(`assigned_to=eq.${EMP}`)
    await select("landing_leads", `select=*&assigned_to=eq.${USER_E2B}`)
    expect(data.at(-1)!.url).toContain(`assigned_to=eq.${EMP}`)
  })
  it("modification (PATCH) d'un lead par un employé : limitée à ses dossiers", async () => {
    world(WORLD)
    cookieState.token = "tok-emp"
    await update("landing_leads", "id=eq.00000000-0000-4000-8000-000000000001", { status: "perdu" })
    expect(data.at(-1)!.method).toBe("PATCH")
    expect(data.at(-1)!.url).toContain(`assigned_to=eq.${EMP}`)
  })
  it("administrateur : aucune restriction ; autres tables : aucune restriction ajoutée à un employé", async () => {
    world(WORLD)
    cookieState.token = "tok-admin"
    await select("landing_leads", "select=*")
    expect(data.at(-1)!.url).not.toContain("assigned_to=")
    cookieState.token = "tok-emp"
    resetSessionOrgCache()
    await select("landing_events", "select=*")
    expect(data.at(-1)!.url).not.toContain("assigned_to=")
  })
  it("contrôle interne explicite (runUnscopedLeads) et point d'entrée public (contexte explicite) : non restreints", async () => {
    world(WORLD)
    cookieState.token = "tok-emp"
    await runUnscopedLeads(() => select("landing_leads", "select=id"))
    expect(data.at(-1)!.url).not.toContain("assigned_to=")
    await withPublicOrg(() => select("landing_leads", "select=id"))
    expect(data.at(-1)!.url).not.toContain("assigned_to=")
  })
  it("sans session (formulaire public, webhook) : aucune restriction « employé »", async () => {
    world(WORLD)
    cookieState.token = undefined
    await withPublicOrg(() => select("landing_leads", "select=id"))
    expect(data.at(-1)!.url).not.toContain("assigned_to=")
  })
})
