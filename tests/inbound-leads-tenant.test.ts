import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: vi.fn(async () => undefined) }))

import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { ingestExternalLead } from "@/lib/server/inbound-leads"
import { configureAll } from "./helpers"

// Charges SIMULÉES : ce test prouve que le service range le lead dans l'entreprise PASSÉE et la cherche seulement chez elle.
const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"

const posted: { table: string; body: Record<string, unknown> }[] = []
const lookups: string[] = []

beforeEach(() => {
  configureAll()
  resetTenantModeCache(); resetPublicOrgCache()
  posted.length = 0; lookups.length = 0
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json(dec.includes("slug=eq.easy2book") ? [{ id: E2B }] : [{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body))
      posted.push({ table, body })
      if (table === "landing_leads") {
        // 2e envoi de la même clé dans la même entreprise → violation d'unicité (comme la base réelle)
        const key = body.idempotency_key
        const dup = posted.filter((p) => p.table === "landing_leads" && p.body.idempotency_key === key && p.body.organization_id === body.organization_id).length > 1
        return dup ? json({ code: "23505" }, 409) : json([{ id: "lead-" + posted.length }], 201)
      }
      return json([], 201)
    }
    if (table === "landing_leads") { lookups.push(dec); return json([{ ref: "E2B-EXISTANT", id: "lead-1" }]) }
    return json([])
  }))
})
afterEach(() => vi.unstubAllGlobals())

const input = { platform: "facebook" as const, externalId: "555566667777", name: "Amel Trabelsi", phone: "22 345 678", contactConsent: true }

describe("lead externe en mode multi-entreprises", () => {
  it("le lead est enregistré dans l'entreprise passée, jamais dans une autre", async () => {
    await ingestExternalLead(BOB, input)
    const lead = posted.find((p) => p.table === "landing_leads")!
    expect(lead.body.organization_id).toBe(BOB)
    expect(lead.body.organization_id).not.toBe(E2B)
    const act = posted.find((p) => p.table === "landing_lead_activities")
    expect(act).toBeTruthy()
  })

  it("le même événement dans deux entreprises : deux prospects distincts, chacun dans la sienne", async () => {
    await ingestExternalLead(E2B, input)
    await ingestExternalLead(BOB, input)
    const orgs = posted.filter((p) => p.table === "landing_leads").map((p) => p.body.organization_id)
    expect(orgs).toEqual([E2B, BOB])
  })

  it("rejeu dans la même entreprise : doublon détecté, recherche limitée à CETTE entreprise", async () => {
    await ingestExternalLead(BOB, input)
    const again = await ingestExternalLead(BOB, input)
    expect(again).toMatchObject({ ok: true, duplicate: true })
    expect(lookups.length).toBeGreaterThan(0)
    for (const q of lookups) expect(q).toContain(`organization_id=eq.${BOB}`)
  })
})
