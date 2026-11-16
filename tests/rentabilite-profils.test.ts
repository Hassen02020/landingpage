// Rentabilité par région, ensemble de publicités, annonce et tranche d'âge DÉCLARÉE.
// ATTENTION : jeu de données ENTIÈREMENT FICTIF (tests), il ne décrit aucun client réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { economics, type CommissionRow, type EconLead, type SpendRow } from "../lib/ad-economics"
import { loadProfitability } from "@/lib/server/profitability"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import type { Status } from "../lib/status"
import { configureAll } from "./helpers"

let n = 0
const lead = (o: Partial<EconLead> & { status?: Status } = {}): EconLead => ({
  id: o.id ?? `P${++n}`, created_at: "2026-11-02T10:00:00Z", status: o.status ?? "nouveau", booking_value: null, booked_at: null,
  channel: "meta", utm_campaign: "omra-ramadan-2027-fb", product: "omra", niche: null, ...o,
})
const booked = (o: Partial<EconLead> = {}) => lead({ status: "reserve", booked_at: "2026-11-09", ...o })
const spend = (amount: number): SpendRow => ({ spend_date: "2026-11-05", network: "meta", campaign: "omra-ramadan-2027-fb", amount_tnd: amount })
const conf = (lead_id: string, amount = 300): CommissionRow => ({ lead_id, kind: "commission", amount_tnd: amount, status: "confirme" })

function dataset() {
  const tunis = [...Array(5)].map(() => booked({ region: "Tunis", utm_term: "tunisie-arabe-fr", utm_content: "video-omra" })).concat([lead({ region: "Tunis", utm_term: "tunisie-arabe-fr", utm_content: "video-omra" })])
  const sfax = [booked({ region: "Sfax", utm_term: "sfax-arabe", utm_content: "image-hotel" }), lead({ region: "Sfax", utm_term: "sfax-arabe", utm_content: "image-hotel" }), lead({ region: "Sfax", utm_term: "sfax-arabe", utm_content: "image-hotel" }), lead({ region: "Sfax", utm_term: "sfax-arabe", utm_content: "image-hotel" })]
  const sousse = [lead({ region: "Sousse", adset_id: "999", ad_id: "ad-7" }), lead({ region: "Sousse", adset_id: "999", ad_id: "ad-7" })]
  const unknown = [lead({}), lead({ age_range: "35-44" })]
  const leads = [...tunis, ...sfax, ...sousse, ...unknown]
  const commissions = leads.filter((l) => l.status === "reserve").map((l) => conf(l.id))
  return { leads, commissions }
}
const run = (dim: Parameters<typeof economics>[1]) => { const d = dataset(); return economics({ leads: d.leads, activities: [], spends: [spend(700)], commissions: d.commissions }, dim) }
const row = (r: ReturnType<typeof run>, key: string) => r.rows.find((x) => x.key === key)!

describe("rentabilité par région", () => {
  it("regroupe les leads, les réservations et les commissions par gouvernorat ; sans région : « non renseignée »", () => {
    const r = run("region")
    expect(row(r, "Tunis").metrics).toMatchObject({ leads: 6, bookings: 5, confirmedBookings: 5, commissionConfirmed: 1500 })
    expect(row(r, "Sfax").metrics).toMatchObject({ leads: 4, bookings: 1 })
    expect(row(r, "Sousse").metrics).toMatchObject({ leads: 2, bookings: 0 })
    expect(row(r, "(non renseignée)").metrics.leads).toBe(2)
  })

  it("la dépense est répartie au prorata des leads et marquée ESTIMÉE (jamais présentée comme réelle) ; le total reste exact", () => {
    const r = run("region")
    expect(r.rows.every((x) => x.spendBasis === "estimee")).toBe(true)
    expect(row(r, "Tunis").metrics.spend).toBe(300)
    expect(Math.round(r.rows.reduce((a, x) => a + x.metrics.spend, 0))).toBe(700)
    expect(r.total.metrics.spend).toBe(700)
  })

  it("taille d'échantillon : seule la région avec au moins 5 réservations confirmées est comparable et peut être « gagnante »", () => {
    const r = run("region")
    expect(row(r, "Tunis").sufficient).toBe(true)
    expect(row(r, "Sfax").sufficient).toBe(false)
    expect(row(r, "Sousse").sufficient).toBe(false)
    expect(r.winnerKey).toBe("Tunis")
  })

  it("aucune gagnante quand aucune région n'atteint l'échantillon minimal", () => {
    const d = dataset()
    const few = d.leads.filter((l) => l.region !== "Tunis")
    const r = economics({ leads: few, activities: [], spends: [spend(700)], commissions: d.commissions.filter((c) => few.some((l) => l.id === c.lead_id)) }, "region")
    expect(r.winnerKey).toBeNull()
    expect(r.winnerReason).toMatch(/au moins 5 réservations/)
  })
})

describe("rentabilité par ensemble de publicités, annonce et tranche d'âge déclarée", () => {
  it("ensemble : nom du lien (utm_term), à défaut l'identifiant ; sinon « inconnu »", () => {
    const r = run("adset")
    expect(row(r, "tunisie-arabe-fr").metrics.leads).toBe(6)
    expect(row(r, "sfax-arabe").metrics.leads).toBe(4)
    expect(row(r, "999").metrics.leads).toBe(2)
    expect(row(r, "(inconnu)").metrics.leads).toBe(2)
  })

  it("annonce : identifiant, à défaut le nom (utm_content)", () => {
    const r = run("ad")
    expect(row(r, "video-omra").metrics.leads).toBe(6)
    expect(row(r, "image-hotel").metrics.leads).toBe(4)
    expect(row(r, "ad-7").metrics.leads).toBe(2)
  })

  it("tranche d'âge : seulement celle que le visiteur a déclarée ; tous les autres sont « non renseignée » (jamais déduite)", () => {
    const r = run("age")
    expect(row(r, "35-44").metrics.leads).toBe(1)
    expect(row(r, "(non renseignée)").metrics.leads).toBe(r.total.metrics.leads - 1)
  })

  it("chaque vue conserve les mêmes totaux (leads, réservations, commissions)", () => {
    const base = run("network").total.metrics
    for (const d of ["region", "adset", "ad", "age", "product"] as const) {
      const t = run(d).total.metrics
      expect([t.leads, t.bookings, t.commissionConfirmed, t.spend]).toEqual([base.leads, base.bookings, base.commissionConfirmed, base.spend])
    }
  })
})

describe("chargement : colonnes facultatives selon les migrations appliquées", () => {
  const E2B = "00000000-0000-4000-8000-0000000e2b01"
  let urls: string[]
  beforeEach(() => {
    configureAll(); resetTenantModeCache(); resetPublicOrgCache(); urls = []
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const dec = decodeURIComponent(String(url)); urls.push(dec)
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
      if (dec.includes("/rest/v1/organizations?")) return json([{ id: E2B }])
      const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
      if (table === "landing_leads") {
        if (dec.includes("age_range")) return json({ code: "42703", message: "column landing_leads.age_range does not exist" }, 400)
        return json([{ id: "r1", organization_id: E2B, created_at: "2026-11-10T10:00:00Z", status: "nouveau", channel: "meta", utm_campaign: "c", product: "omra", region: "Tunis" }])
      }
      return json([])
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("base sans la colonne de tranche d'âge : la page se charge quand même (lecture de repli, région conservée)", async () => {
    const d = await runWithOrg(E2B, () => loadProfitability({ from: "2026-11-01", to: "2026-11-30" }, "region"))
    expect(d.leadCount).toBe(1)
    expect(d.result.rows[0].key).toBe("Tunis")
    const reads = urls.filter((u) => u.includes("landing_leads?"))
    expect(reads.length).toBeGreaterThanOrEqual(2)
    expect(reads[0]).toContain("age_range")
    expect(reads[reads.length - 1]).not.toContain("age_range")
  })
})
