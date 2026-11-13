import { describe, expect, it } from "vitest"
import { formatStat, pageStats, UNAVAILABLE, type StatInput } from "@/lib/page-builder/stats"
import { economics, type EconLead } from "@/lib/ad-economics"

const card = (cs: ReturnType<typeof pageStats>, id: string) => cs.find((c) => c.id === id)!
const base = (o: Partial<StatInput> = {}): StatInput => ({ metrics: null, spendBasis: "aucune", ledgerAvailable: true, consentingVisitors: 12, ...o })

describe("statistiques d'une page : jamais d'invention", () => {
  it("page sans prospect ni dépense : prospects 0 ; dépenses et marge NON DISPONIBLES ; visites NON DISPONIBLES", () => {
    const cs = pageStats(base())
    expect(card(cs, "prospects").value).toBe(0)
    expect(formatStat(card(cs, "depenses"))).toBe(UNAVAILABLE)
    expect(formatStat(card(cs, "marge"))).toBe(UNAVAILABLE)
    expect(formatStat(card(cs, "visites"))).toBe(UNAVAILABLE)
    expect(card(cs, "visiteurs").value).toBe(12)
  })
  it("registre non installé : réservations, commission, dépenses et marge NON DISPONIBLES (pas 0)", () => {
    const cs = pageStats(base({ ledgerAvailable: false }))
    for (const id of ["reservations", "commission", "depenses", "marge"]) expect(card(cs, id).value, id).toBeNull()
  })
  it("lecture des visiteurs impossible : NON DISPONIBLE", () => {
    expect(card(pageStats(base({ consentingVisitors: null })), "visiteurs").value).toBeNull()
  })
})

const lead = (id: string, status: EconLead["status"], campaign: string, niche: string, booking: number | null = null): EconLead => ({ id, created_at: "2026-11-01T10:00:00Z", status, booking_value: booking, booked_at: status === "reserve" ? "2026-11-05T10:00:00Z" : null, channel: "meta", utm_campaign: campaign, product: "voyage", niche })
describe("avec le moteur de rentabilité existant (une seule vérité)", () => {
  const leads = [lead("a", "nouveau", "camp", "turquie"), lead("b", "qualifie", "camp", "turquie"), lead("c", "devis", "camp", "turquie"), lead("d", "reserve", "camp", "turquie", 5000), lead("e", "nouveau", "camp", "autre-page")]
  const acts: never[] = []
  const run = (commissions: { lead_id: string; kind: "commission"; amount_tnd: number; status: "provisoire" | "confirme" }[]) => {
    const r = economics({ leads, activities: acts, spends: [{ spend_date: "2026-11-02", network: "meta", campaign: "camp", amount_tnd: 100 }], commissions }, "niche")
    return r.rows.find((x) => x.key === "turquie")!
  }
  it("le chiffre d'affaires d'une réservation (5 000 TND) n'est JAMAIS la commission conservée", () => {
    const row = run([{ lead_id: "d", kind: "commission", amount_tnd: 300, status: "confirme" }])
    const cs = pageStats({ metrics: row.metrics, spendBasis: row.spendBasis, ledgerAvailable: true, consentingVisitors: 3 })
    expect(card(cs, "commission").value).toBe(300)
    expect(JSON.stringify(cs)).not.toContain("5000")
    expect(card(cs, "prospects").value).toBe(4)
    expect(card(cs, "qualifies").value).toBe(3)
    expect(card(cs, "devis").value).toBe(2)
    expect(card(cs, "reservations").value).toBe(1)
  })
  it("commission seulement provisoire : 0 conservée, signalée à part ; réservation sans commission : marge signalée non représentative", () => {
    const prov = run([{ lead_id: "d", kind: "commission", amount_tnd: 300, status: "provisoire" }])
    const c1 = pageStats({ metrics: prov.metrics, spendBasis: prov.spendBasis, ledgerAvailable: true, consentingVisitors: 0 })
    expect(card(c1, "commission").value).toBe(0)
    expect(card(c1, "commission").note).toMatch(/Provisoire, non comptée : 300/)
    const none = run([])
    const c2 = pageStats({ metrics: none.metrics, spendBasis: none.spendBasis, ledgerAvailable: true, consentingVisitors: 0 })
    expect(card(c2, "marge").note).toMatch(/Non représentative/)
    expect(card(c2, "commission").tone).toBe("warn")
  })
  it("campagne partagée entre deux pages : dépense ESTIMÉE (répartie au prorata), signalée", () => {
    const row = run([])
    expect(row.spendBasis).toBe("estimee")
    const cs = pageStats({ metrics: row.metrics, spendBasis: row.spendBasis, ledgerAvailable: true, consentingVisitors: 0 })
    expect(card(cs, "depenses").value).toBe(80)
    expect(card(cs, "depenses").note).toMatch(/Estimée/)
    expect(card(cs, "depenses").tone).toBe("warn")
  })
})
