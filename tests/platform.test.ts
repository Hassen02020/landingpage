import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { createOrganization, setOrganizationStatus, slugify } from "@/lib/server/platform"
import { resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const ACTOR = { userId: "99999999-9999-4999-8999-999999999999", email: "super@x.tn" }
const base = { name: "Carol Voyages", slug: "", sector: "voyage", adminEmail: "carol@carol.tn", adminName: "Carol" }
let calls: string[] = []

function world(opts: { slugTaken?: boolean; inviteStatus?: number } = {}) {
  calls = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: any = {}) => {
    const u = decodeURIComponent(String(url))
    calls.push(`${init.method ?? "GET"} ${u}`)
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (u.includes("/rest/v1/organizations?")) return json(u.includes("slug=eq.") ? (opts.slugTaken ? [{ id: "x" }] : []) : [{ id: "00000000-0000-4000-8000-0000000e2b01" }])
    if (u.includes("/auth/v1/invite")) return json(opts.inviteStatus && opts.inviteStatus !== 200 ? { msg: "x" } : { id: "cccccccc-0000-4000-8000-000000000001" }, opts.inviteStatus ?? 200)
    if (u.includes("/rpc/landing_create_organization")) return json("dddddddd-0000-4000-8000-000000000001")
    return json([])
  }))
}
beforeEach(() => { configureAll(); resetTenantModeCache() })
afterEach(() => vi.unstubAllGlobals())

describe("slugify", () => {
  it("normalise accents, espaces et symboles", () => {
    expect(slugify("Café Évasion & Co.")).toBe("cafe-evasion-co")
    expect(slugify("  --Bob SARL--  ")).toBe("bob-sarl")
  })
})

describe("createOrganization : validation avant toute écriture", () => {
  it.each([
    [{ ...base, name: "A" }, /Nom/],
    [{ ...base, slug: "Bad Slug!" }, /Identifiant/],
    [{ ...base, slug: "admin" }, /réservé/],
    [{ ...base, slug: "easy2book" }, /réservé/],
    [{ ...base, adminEmail: "pas-un-mail" }, /e-mail/],
  ])("refuse %# sans appeler Supabase pour inviter", async (input, re) => {
    world()
    const r = await createOrganization(input, ACTOR)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(re)
    expect(calls.some((c) => c.includes("/auth/v1/invite") || c.includes("/rpc/"))).toBe(false)
  })
  it("identifiant déjà pris : aucune invitation envoyée", async () => {
    world({ slugTaken: true })
    const r = await createOrganization(base, ACTOR)
    expect(r.ok === false && r.error).toMatch(/déjà utilisé/)
    expect(calls.some((c) => c.includes("/auth/v1/invite"))).toBe(false)
  })
  it("chemin nominal : invitation PUIS création atomique, acteur transmis, aucun mot de passe", async () => {
    world()
    const r = await createOrganization(base, ACTOR)
    expect(r).toMatchObject({ ok: true, slug: "carol-voyages", email: "carol@carol.tn", invited: true })
    const rpc = calls.find((c) => c.includes("/rpc/landing_create_organization"))!
    expect(calls.findIndex((c) => c.includes("/auth/v1/invite"))).toBeLessThan(calls.indexOf(rpc))
    const body = (vi.mocked(fetch).mock.calls.find((c) => String(c[0]).includes("/rpc/landing_create_organization"))![1] as any).body
    expect(JSON.parse(body)).toMatchObject({ p_actor: ACTOR.userId, p_slug: "carol-voyages" })
    expect(String(body)).not.toMatch(/password/i)
  })
  it("limite d'envoi d'e-mails (429) : message clair, aucune création", async () => {
    world({ inviteStatus: 429 })
    const r = await createOrganization(base, ACTOR)
    expect(r.ok === false && r.error).toMatch(/SMTP|Trop/)
    expect(calls.some((c) => c.includes("/rpc/"))).toBe(false)
  })
})

describe("setOrganizationStatus", () => {
  it("refuse un identifiant mal formé sans appel", async () => {
    world()
    expect((await setOrganizationStatus("pas-un-uuid", "suspended", ACTOR)).ok).toBe(false)
    expect(calls.some((c) => c.includes("/rpc/"))).toBe(false)
  })
})
