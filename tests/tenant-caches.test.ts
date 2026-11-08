import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { resetIntegrationCache, resolveIntegration } from "@/lib/server/integrations"
import { checkLead, resetProtectionCache } from "@/lib/server/protection"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"

let integrationReads = 0
function world(orgs: string[]) {
  integrationReads = 0
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
    if (dec.includes("/rest/v1/organizations?")) {
      if (dec.includes("slug=eq.easy2book")) return json([{ id: E2B }])
      return json(orgs.map((id) => ({ id })))
    }
    if (dec.includes("/rest/v1/landing_integrations?")) {
      integrationReads++
      const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
      return json(org === BOB ? [{ provider: "meta", enabled: true, pixel_id: "BOB-PIXEL", token_ciphertext: null, test_event_code: null }] : [])
    }
    if (dec.includes("/rest/v1/landing_protection?")) {
      const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
      return json([{ allowed_countries: org === BOB ? ["FR"] : ["TN"] }])
    }
    return json([])
  }))
}

beforeEach(() => {
  configureAll()
  process.env.META_ACCESS_TOKEN = "E2B-SECRET-TOKEN"
  resetTenantModeCache(); resetPublicOrgCache(); resetIntegrationCache(); resetProtectionCache()
})
afterEach(() => { vi.unstubAllGlobals(); delete process.env.META_ACCESS_TOKEN })

describe("caches par organisation (mode multi)", () => {
  it("le cache des intégrations n'est jamais partagé entre deux entreprises", async () => {
    world([E2B, BOB])
    const a = await runWithOrg(E2B, () => resolveIntegration("meta"))
    const b = await runWithOrg(BOB, () => resolveIntegration("meta"))
    expect(b.pixelId).toBe("BOB-PIXEL")
    expect(a.pixelId).not.toBe("BOB-PIXEL")
    expect(integrationReads).toBe(2)
    await runWithOrg(BOB, () => resolveIntegration("meta"))
    expect(integrationReads).toBe(2) // 2e lecture de Bob : servie par SON cache
  })

  it("une autre entreprise n'hérite JAMAIS du jeton ni du pixel Vercel d'Easy2Book", async () => {
    world([E2B, BOB])
    const a = await runWithOrg(E2B, () => resolveIntegration("meta"))
    expect(a.token).toBe("E2B-SECRET-TOKEN")
    expect(a.tokenSource).toBe("vercel")
    // organisation sans ligne d'intégration : rien du tout
    const OTHER = "00000000-0000-4000-8000-0000000000c0"
    world([E2B, BOB, OTHER])
    const c = await runWithOrg(OTHER, () => resolveIntegration("meta"))
    expect(c.token).toBeUndefined()
    expect(c.pixelId).toBeUndefined()
    expect(c.enabled).toBe(false)
    expect(c.tokenSource).toBe("none")
  })

  it("avec une seule organisation, les variables Vercel restent utilisées (production actuelle)", async () => {
    world([E2B])
    const a = await runWithOrg(E2B, () => resolveIntegration("meta"))
    expect(a.token).toBe("E2B-SECRET-TOKEN")
    expect(a.enabled).toBe(true)
  })

  it("le cache de protection est par organisation", async () => {
    world([E2B, BOB])
    // Easy2Book n'autorise que la Tunisie, Bob que la France : un cache partagé donnerait la même réponse aux deux
    const a = await runWithOrg(E2B, () => checkLead({ phone: null, country: "FR" }))
    const b = await runWithOrg(BOB, () => checkLead({ phone: null, country: "FR" }))
    expect(a).toEqual({ blocked: true, reason: "country" })
    expect(b).toEqual({ blocked: false })
  })
})
