import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { addVariableCost, listVariableCosts, voidVariableCost } from "@/lib/server/variable-costs"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
type Row = Record<string, unknown>
let costs: Row[], seq: number, absent: boolean
const leads: Row[] = [{ id: "lead-e1", ref: "E2B-ABC234", organization_id: E2B }, { id: "lead-b1", ref: "E2B-BOB234", organization_id: BOB }]
const as = <T,>(org: string, fn: () => Promise<T>) => runWithOrg(org, fn) as Promise<T>
const base = { date: "2026-11-05", category: "frais_paiement", amount: "20" }

beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache(); costs = []; seq = 0; absent = false
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json([{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1]
    const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
    if (table === "landing_variable_costs" && absent) return json({ code: "42P01" }, 404)
    if (init.method === "POST" && table === "landing_variable_costs") { const row = { id: ++seq, ...JSON.parse(String(init.body)) }; costs.push(row); return json([row], 201) }
    if (table === "landing_variable_costs") {
      let rows = costs.filter((c) => c.organization_id === org)
      const id = dec.match(/[?&]id=eq\.(\d+)/)?.[1]; if (id) rows = rows.filter((c) => String(c.id) === id)
      const v = dec.match(/voids_id=eq\.(\d+)/)?.[1]; if (v) rows = rows.filter((c) => String(c.voids_id) === v)
      return json(rows)
    }
    if (table === "landing_leads") { const ref = dec.match(/ref=eq\.([A-Z0-9-]+)/)?.[1]; return json(leads.filter((l) => l.organization_id === org && l.ref === ref)) }
    return json([])
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe("coûts variables (serveur)", () => {
  it("rattache à une réservation de SON entreprise ; référence d'une autre entreprise introuvable", async () => {
    expect(await as(E2B, () => addVariableCost({ ...base, leadRef: "e2b-abc234" }, "u1"))).toEqual({ ok: true })
    expect(costs[0]).toMatchObject({ organization_id: E2B, lead_id: "lead-e1", network: null, campaign: null, amount_tnd: 20, created_by: "u1" })
    expect(await as(E2B, () => addVariableCost({ ...base, leadRef: "E2B-BOB234" }, null))).toMatchObject({ ok: false, errors: { leadRef: expect.stringMatching(/introuvable/) } })
    expect(costs).toHaveLength(1)
  })
  it("réservation ET campagne refusés (double comptage) ; campagne seule acceptée ; sans rattachement accepté", async () => {
    expect(await as(E2B, () => addVariableCost({ ...base, leadRef: "E2B-ABC234", network: "meta", campaign: "Omra" }, null))).toMatchObject({ ok: false, errors: { leadRef: expect.stringMatching(/deux fois/) } })
    expect(await as(E2B, () => addVariableCost({ ...base, network: "meta", campaign: "Omra 2027" }, null))).toEqual({ ok: true })
    expect(await as(E2B, () => addVariableCost(base, null))).toEqual({ ok: true })
    expect(costs).toHaveLength(2)
    expect(costs[0]).toMatchObject({ lead_id: null, network: "meta", campaign: "Omra 2027" })
  })
  it("catégories « publicité » et « remboursement » refusées ; montant et date validés", async () => {
    for (const category of ["publicite", "remboursement"]) expect(await as(E2B, () => addVariableCost({ ...base, category }, null))).toMatchObject({ ok: false, errors: { category: expect.any(String) } })
    expect(await as(E2B, () => addVariableCost({ date: "2026-02-30", category: "autre", amount: "0" }, null))).toMatchObject({ ok: false, errors: { date: expect.any(String), amount: expect.any(String) } })
  })
  it("annulation : écriture opposée au même rattachement ; une seule fois ; pas celle d'une autre entreprise", async () => {
    await as(E2B, () => addVariableCost({ ...base, leadRef: "E2B-ABC234" }, null))
    expect(await as(BOB, () => voidVariableCost(1, null))).toMatchObject({ ok: false })
    expect(await as(E2B, () => voidVariableCost(1, "u1"))).toEqual({ ok: true })
    expect(costs[1]).toMatchObject({ amount_tnd: -20, voids_id: 1, lead_id: "lead-e1", category: "frais_paiement" })
    expect(await as(E2B, () => voidVariableCost(1, null))).toMatchObject({ ok: false, message: expect.stringMatching(/déjà/) })
    expect(await as(E2B, () => voidVariableCost(2, null))).toMatchObject({ ok: false, message: expect.stringMatching(/ne s'annule pas/) })
  })
  it("migration 0017 absente : message clair, lecture vide", async () => {
    absent = true
    expect(await as(E2B, () => addVariableCost(base, null))).toMatchObject({ ok: false, message: expect.stringMatching(/0017/) })
    expect(await as(E2B, () => listVariableCosts())).toEqual({ rows: [], migrationApplied: false })
  })
})
