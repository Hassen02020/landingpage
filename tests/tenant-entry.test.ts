import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// cookies() de Next : jeton de session simulé
const cookieState = vi.hoisted(() => ({ token: undefined as string | undefined, outsideRequest: false }))
vi.mock("next/headers", () => ({
  cookies: () => {
    if (cookieState.outsideRequest) throw new Error("hors requête")
    return { get: (k: string) => (k === "e2b_admin_at" && cookieState.token ? { value: cookieState.token } : undefined) }
  },
}))

import { resetPublicOrgCache, resetTenantModeCache, select, TenantContextError, withPublicOrg, insertQuiet } from "@/lib/server/db"
import { resetSessionOrgCache, resolveSessionOrg } from "@/lib/server/session-org"
import { findStaff } from "@/lib/server/auth"
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

const MULTI: World = {
  orgs: [{ id: E2B, slug: "easy2book", status: "active" }, { id: BOB, slug: "bob", status: "active" }],
  members: [
    { user_id: USER_E2B, organization_id: E2B, role: "admin", active: true },
    { user_id: USER_BOB, organization_id: BOB, role: "admin", active: true },
  ],
  tokens: { "tok-e2b": USER_E2B, "tok-bob": USER_BOB, "tok-none": USER_NONE },
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

describe("mode multi : organisation du compte connecté (admin) — aucune organisation au hasard", () => {
  it("un compte connecté lit SA organisation : le filtre vient de la session, pas d'un paramètre du navigateur", async () => {
    world(MULTI)
    cookieState.token = "tok-bob"
    await select("landing_leads", "select=*")
    expect(data.at(-1)!.url).toContain(`organization_id=eq.${BOB}`)
    cookieState.token = "tok-e2b"
    resetSessionOrgCache()
    await select("landing_leads", "select=*")
    expect(data.at(-1)!.url).toContain(`organization_id=eq.${E2B}`)
  })

  it("sans session, avec un jeton invalide, ou pour un compte sans organisation : requête REFUSÉE avant la base", async () => {
    world(MULTI)
    for (const [token, label] of [[undefined, "sans cookie"], ["tok-inconnu", "jeton invalide"], ["tok-none", "compte sans organisation"]] as const) {
      cookieState.token = token
      resetSessionOrgCache()
      await expect(select("landing_leads", "select=*"), label).rejects.toBeInstanceOf(TenantContextError)
    }
    cookieState.outsideRequest = true // hors requête (génération statique, tâche de fond)
    await expect(select("landing_leads", "select=*")).rejects.toBeInstanceOf(TenantContextError)
    expect(data.length).toBe(0)
  })

  it("organisation suspendue ou membre désactivé : refus ; l'organisation d'un compte à plusieurs organisations actives est refusée (pas de choix arbitraire)", async () => {
    world({ ...MULTI, orgs: [{ id: E2B, slug: "easy2book", status: "active" }, { id: BOB, slug: "bob", status: "suspended" }] })
    cookieState.token = "tok-bob"
    await expect(select("landing_leads", "select=*")).rejects.toBeInstanceOf(TenantContextError)
    world({ ...MULTI, members: MULTI.members.map((m) => (m.user_id === USER_BOB ? { ...m, active: false } : m)) })
    resetSessionOrgCache()
    await expect(select("landing_leads", "select=*")).rejects.toBeInstanceOf(TenantContextError)
    world({ ...MULTI, members: [...MULTI.members, { user_id: USER_BOB, organization_id: E2B, role: "employee", active: true }] })
    resetSessionOrgCache()
    await expect(select("landing_leads", "select=*")).rejects.toBeInstanceOf(TenantContextError)
  })

  it("la session est vérifiée une seule fois pour plusieurs requêtes (cache 30 s), jamais mélangée entre deux jetons", async () => {
    world(MULTI)
    cookieState.token = "tok-e2b"
    await Promise.all([select("landing_leads", "a=1"), select("landing_events", "a=2"), select("landing_lead_activities", "a=3")])
    expect(authCalls).toBeLessThanOrEqual(3) // requêtes simultanées : au plus une vérification par requête, puis cache
    await select("landing_leads", "a=4")
    expect(authCalls).toBeLessThanOrEqual(3)
    cookieState.token = "tok-bob"
    await select("landing_leads", "a=5")
    expect(data.at(-1)!.url).toContain(`organization_id=eq.${BOB}`)
  })

  it("resolveSessionOrg : null sans cookie / hors requête ; organisation du membre sinon", async () => {
    world(MULTI)
    expect(await resolveSessionOrg()).toBeNull()
    cookieState.token = "tok-e2b"
    expect(await resolveSessionOrg()).toBe(E2B)
    cookieState.outsideRequest = true
    resetSessionOrgCache()
    expect(await resolveSessionOrg()).toBeNull()
  })

  it("connexion (findStaff) : la fiche d'équipe est lue DANS l'organisation du compte, avant même que le cookie existe", async () => {
    world(MULTI)
    await findStaff(USER_BOB)
    const staffCall = data.find((c) => c.url.includes("/rest/v1/landing_staff?"))!
    expect(staffCall.url).toContain(`organization_id=eq.${BOB}`)
    expect(staffCall.url).toContain(`user_id=eq.${USER_BOB}`)
    data.length = 0
    expect(await findStaff(USER_NONE)).toBeNull() // pas membre : jamais de lecture au hasard
    expect(data.length).toBe(0)
  })
})

describe("points d'entrée publics : contexte explicite « site Easy2Book », avant toute session", () => {
  it("un compte connecté d'une AUTRE entreprise qui visite le site public n'écrit PAS dans sa propre organisation", async () => {
    world(MULTI)
    cookieState.token = "tok-bob" // visiteur connecté comme administrateur de Bob
    await withPublicOrg(() => insertQuiet("landing_leads", { ref: "E2B-AAAAAA" }))
    const body = JSON.parse(data.at(-1)!.init.body)
    expect(body.organization_id).toBe(E2B)
    expect(body.organization_id).not.toBe(BOB)
  })

  it("sans session, le site public fonctionne (organisation du site, slug easy2book) ; sans contexte, rien ne passe", async () => {
    world(MULTI)
    await withPublicOrg(() => select("landing_categories", "select=*"))
    expect(data.at(-1)!.url).toContain(`organization_id=eq.${E2B}`)
    await expect(select("landing_categories", "select=*")).rejects.toBeInstanceOf(TenantContextError)
  })

  it("schéma d'avant 0008 (table organizations absente) : le site public fonctionne comme avant, sans contexte ni filtre", async () => {
    world({ ...MULTI, organizationsStatus: 404 })
    await withPublicOrg(() => select("landing_leads", "select=*"))
    expect(data.at(-1)!.url).toBe(`${DB_URL}/rest/v1/landing_leads?select=*`)
  })

  it("organisation du site public introuvable en mode multi : refus (pas de repli au hasard)", async () => {
    world({ ...MULTI, orgs: [{ id: BOB, slug: "bob", status: "active" }, { id: "00000000-0000-4000-8000-0000000000c0", slug: "carl", status: "active" }] })
    await expect(withPublicOrg(() => select("landing_leads", "select=*"))).rejects.toBeInstanceOf(TenantContextError)
  })

  it("la recherche de l'organisation publique n'utilise pas no-store (pages statiques /omra et /c/[slug])", async () => {
    world(MULTI)
    const inits: any[] = []
    const base = globalThis.fetch as any
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: any = {}) => {
      if (decodeURIComponent(String(url)).includes("slug=eq.easy2book")) inits.push(init)
      return base(url, init)
    }))
    await withPublicOrg(() => select("landing_leads", "select=*"))
    expect(inits.length).toBe(1)
    expect(inits[0].cache).not.toBe("no-store")
    expect(inits[0].next).toEqual({ revalidate: 30 })
  })
})
