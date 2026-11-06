import { describe, expect, it } from "vitest"
import { dailySeries, funnel, maxRank, responseTimes, type FunnelActivity, type FunnelLead } from "@/lib/server/analytics"

const lead = (id: string, status: FunnelLead["status"], o: Partial<FunnelLead> = {}): FunnelLead => ({ id, created_at: "2026-11-01T10:00:00Z", status, booking_value: null, booked_at: null, ...o })
const act = (lead_id: string, to_status: FunnelActivity["to_status"], created_at = "2026-11-01T11:00:00Z", o: Partial<FunnelActivity> = {}): FunnelActivity => ({ lead_id, type: "status_change", to_status, created_at, actor_id: "u1", ...o })
const count = (f: ReturnType<typeof funnel>, key: string) => f.find((s) => s.key === key)!.count

describe("entonnoir", () => {
  it("un dossier perdu compte jusqu'à l'étape la plus avancée atteinte (pas seulement son statut actuel)", () => {
    const l = lead("a", "perdu")
    expect(maxRank(l, [])).toBe(0)
    expect(maxRank(l, [act("a", "contacte"), act("a", "devis"), act("a", "perdu")])).toBe(5)
    const f = funnel([l], [act("a", "contacte"), act("a", "devis"), act("a", "perdu")])
    expect(count(f, "recus")).toBe(1)
    expect(count(f, "propositions")).toBe(1)
    expect(count(f, "reserves")).toBe(0)
  })

  it("réservé puis gagné : compté une fois dans « réservés » ; « gagnés » ⊂ « réservés »", () => {
    const leads = [lead("a", "gagne"), lead("b", "reserve"), lead("c", "negociation"), lead("d", "nouveau")]
    const f = funnel(leads, [act("a", "reserve"), act("a", "gagne"), act("b", "reserve")])
    expect(count(f, "recus")).toBe(4)
    expect(count(f, "reserves")).toBe(2)
    expect(count(f, "gagnes")).toBe(1)
    expect(count(f, "propositions")).toBe(3)
    expect(f[0].fromStart).toBe(1)
    expect(f.find((s) => s.key === "reserves")!.fromStart).toBe(0.5)
  })

  it("l'entonnoir est monotone décroissant et sans division par zéro", () => {
    const f = funnel([], [])
    expect(f.every((s) => s.count === 0 && s.fromStart === 0 && s.fromPrevious === (s.key === "recus" ? 1 : 0))).toBe(true)
    const g = funnel([lead("a", "qualifie"), lead("b", "contacte"), lead("c", "nouveau")], [])
    for (let i = 1; i < g.length; i++) expect(g[i].count).toBeLessThanOrEqual(g[i - 1].count)
  })
})

describe("délai de premier traitement", () => {
  it("médiane, moyenne, seuils 1 h / 24 h et dossiers jamais traités", () => {
    const leads = [lead("a", "contacte"), lead("b", "contacte"), lead("c", "contacte"), lead("d", "nouveau")]
    const r = responseTimes(leads, [
      act("a", "contacte", "2026-11-01T10:30:00Z"), // 30 min
      act("b", "contacte", "2026-11-01T14:00:00Z"), // 240 min
      act("c", "contacte", "2026-11-03T10:00:00Z"), // 2 880 min
    ])
    expect(r.treated).toBe(3)
    expect(r.untreated).toBe(1)
    expect(r.medianMinutes).toBe(240)
    expect(r.within1h).toBe(1)
    expect(r.within24h).toBe(2)
  })

  it("seul un acte d'un membre de l'équipe compte (pas le système, pas la création) ; le premier acte l'emporte", () => {
    const l = [lead("a", "nouveau")]
    expect(responseTimes(l, [{ lead_id: "a", type: "created", to_status: null, created_at: "2026-11-01T10:01:00Z", actor_id: null }, act("a", "contacte", "2026-11-01T10:02:00Z", { actor_id: null })]).treated).toBe(0)
    const r = responseTimes(l, [act("a", "contacte", "2026-11-01T12:00:00Z"), { lead_id: "a", type: "note", to_status: null, created_at: "2026-11-01T10:20:00Z", actor_id: "u1" }])
    expect(r.medianMinutes).toBe(20)
    expect(responseTimes([], []).medianMinutes).toBeNull()
  })
})

describe("série par jour", () => {
  it("jours sans activité inclus ; vente comptée au jour de la réservation, une seule fois", () => {
    const leads = [
      lead("a", "gagne", { booking_value: 9000, booked_at: "2026-11-03T09:00:00Z" }),
      lead("b", "nouveau", { created_at: "2026-11-02T09:00:00Z" }),
      lead("c", "perdu", { created_at: "2026-10-01T09:00:00Z" }), // hors période
    ]
    const s = dailySeries(leads, { from: "2026-11-01", to: "2026-11-04" })
    expect(s.map((d) => d.day)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"])
    expect(s[0].leads).toBe(1)
    expect(s[1].leads).toBe(1)
    expect(s.reduce((a, d) => a + d.sales, 0)).toBe(1)
    expect(s[2].revenue).toBe(9000)
    expect(s.reduce((a, d) => a + d.leads, 0)).toBe(2)
  })
})
