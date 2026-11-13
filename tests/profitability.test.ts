import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { loadProfitability } from "@/lib/server/profitability"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
type Row = Record<string, unknown>
let tables: Record<string, Row[]>, missing: string[]
const P = { from: "2026-11-01", to: "2026-11-30" }
const as = <T,>(org: string, fn: () => Promise<T>) => runWithOrg(org, fn) as Promise<T>

beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache(); missing = []
  const lead = (id: string, org: string, extra: Row = {}) => ({ id, organization_id: org, created_at: "2026-11-10T10:00:00Z", status: "reserve", booking_value: null, booked_at: "2026-11-12", channel: "meta", utm_campaign: "Omra 2027", product: "omra", niche: "omra", ...extra })
  tables = {
    landing_leads: [lead("e1", E2B), lead("e2", E2B), lead("b1", BOB), lead("old", E2B, { created_at: "2026-09-01T10:00:00Z" })],
    landing_lead_activities: [],
    landing_ad_spend: [{ organization_id: E2B, spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: 100, voids_id: null }, { organization_id: BOB, spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: 999, voids_id: null }],
    landing_variable_costs: [{ organization_id: E2B, cost_date: "2026-11-06", category: "frais_paiement", amount_tnd: 10, lead_id: "e1", network: null, campaign: null, voids_id: null }],
    landing_commissions: [{ organization_id: E2B, lead_id: "e1", kind: "commission", amount_tnd: 300, status: "confirme" }, { organization_id: E2B, lead_id: "e2", kind: "commission", amount_tnd: 200, status: "provisoire" }, { organization_id: BOB, lead_id: "b1", kind: "commission", amount_tnd: 5000, status: "confirme" }],
  }
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json([{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (missing.includes(table)) return json({ code: "42P01" }, 404)
    const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
    let rows = (tables[table] ?? []).filter((r) => r.organization_id === org)
    if (table === "landing_leads") rows = rows.filter((r) => String(r.created_at) >= "2026-10-31T23:00:00Z" && String(r.created_at) <= "2026-11-30T23:00:00Z")
    return json(rows)
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe("chargement de la rentabilité", () => {
  it("calcule la marge de SON entreprise seulement (aucune donnée d'une autre entreprise, aucun lead hors période)", async () => {
    const d = await as(E2B, () => loadProfitability(P, "campaign"))
    expect(d.leadCount).toBe(2)
    expect(d.result.total.metrics).toMatchObject({ spend: 100, variableCosts: 10, commissionConfirmed: 300, commissionProvisional: 200, marginConfirmed: 190, marginWithProvisional: 390, confirmedBookings: 1 })
    expect(d.migrationApplied).toBe(true)
    const bob = await as(BOB, () => loadProfitability(P, "campaign"))
    expect(bob.result.total.metrics).toMatchObject({ spend: 999, commissionConfirmed: 5000 })
  })
  it("tables 0016/0017 absentes : le calcul reste possible (zéros) et l'écran est averti", async () => {
    missing = ["landing_ad_spend", "landing_variable_costs", "landing_commissions"]
    const d = await as(E2B, () => loadProfitability(P, "network"))
    expect(d.migrationApplied).toBe(false)
    expect(d.result.total.metrics).toMatchObject({ spend: 0, commissionNet: 0, marginConfirmed: 0 })
  })
})
