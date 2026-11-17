// Chargement de l'Intelligence Center : repli selon les migrations appliquées, cloisonnement par entreprise, droit financier.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { loadOverview, loadQuality } from "@/lib/server/intelligence"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const P = { from: "2026-11-01", to: "2026-11-30" }
type Row = Record<string, unknown>
let leads: Row[], urls: string[], govCols: boolean
const L = (id: string, org: string, extra: Row = {}) => ({ id, organization_id: org, created_at: "2026-11-10T10:00:00Z", status: "nouveau", channel: "meta", utm_campaign: null, tracking_consent: true, region: null, booking_value: null, booked_at: null, ...extra })

beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache(); urls = []; govCols = false
  leads = [L("e1", E2B), L("e2", E2B, { status: "reserve", booked_at: "2026-11-12T10:00:00Z", booking_value: 6000 }), L("b1", BOB)]
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    const dec = decodeURIComponent(String(url)); urls.push(dec)
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json([{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (table === "landing_leads") {
      if (!govCols && dec.includes("is_test")) return json({ code: "42703", message: "column landing_leads.is_test does not exist" }, 400)
      const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
      return json(leads.filter((r) => r.organization_id === org))
    }
    return json([])
  }))
})
afterEach(() => vi.unstubAllGlobals())
const as = <T,>(org: string, fn: () => Promise<T>) => runWithOrg(org, fn) as Promise<T>

describe("qualité des données : chargement", () => {
  it("base sans les colonnes de gouvernance : lecture de repli, contrôle déclaré indisponible", async () => {
    const q = await as(E2B, () => loadQuality(P, false))
    expect(q.governanceColumns).toBe(false)
    expect(q.total).toBe(2)
    expect(q.unavailable.map((u) => u.key)).toContain("governance")
    const reads = urls.filter((u) => u.includes("landing_leads?"))
    expect(reads.length).toBeGreaterThanOrEqual(2)
    expect(reads[0]).toContain("is_test")
    expect(reads[reads.length - 1]).not.toContain("is_test")
  })

  it("base à jour : colonnes de gouvernance lues, leads de test exclus", async () => {
    govCols = true
    leads.push(L("t1", E2B, { is_test: true }))
    const q = await as(E2B, () => loadQuality(P, false))
    expect(q.governanceColumns).toBe(true)
    expect(q.excludedTests).toBe(1)
    expect(q.total).toBe(2)
  })

  it("ne lit que les leads de SON entreprise", async () => {
    const q = await as(BOB, () => loadQuality(P, false))
    expect(q.total).toBe(1)
  })

  it("sans droit financier : aucune lecture des commissions ni des dépenses", async () => {
    await as(E2B, () => loadQuality(P, false))
    expect(urls.some((u) => /landing_commissions|landing_ad_spend/.test(u))).toBe(false)
  })

  it("avec le droit financier : lit les commissions pour les réservations sans commission", async () => {
    const q = await as(E2B, () => loadQuality(P, true))
    expect(urls.some((u) => /landing_commissions/.test(u))).toBe(true)
    expect(q.issues.find((i) => i.key === "bookings_without_commission")?.count).toBe(1)
  })
})

describe("vue d'ensemble : chargement", () => {
  it("sans droit financier : dépenses et marge = null (« — »), jamais 0 ; aucune lecture financière", async () => {
    const o = await as(E2B, () => loadOverview(P, false))
    expect(o).toMatchObject({ leads: 2, bookings: 1, spend: null, marginConfirmed: null, financeIncluded: false })
    expect(urls.some((u) => /landing_commissions|landing_ad_spend/.test(u))).toBe(false)
  })
  it("avec le droit financier : dépenses et marge lues", async () => {
    const o = await as(E2B, () => loadOverview(P, true))
    expect(o.spend).toBe(0)
    expect(o.financeIncluded).toBe(true)
  })
  it("l'entonnoir et les alertes ne portent que sur l'entreprise courante", async () => {
    const o = await as(BOB, () => loadOverview(P, false))
    expect(o.leads).toBe(1)
    expect(o.alerts.map((a) => a.key)).toContain("no_bookings")
  })
})
