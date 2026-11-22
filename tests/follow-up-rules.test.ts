// Règles de relance (lot B). Jeux de données FICTIFS, aucun appel réseau réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { DEFAULT_RULES, buildWorklist, evaluateLead, shouldStopConversionFollowUps, type RuleLead } from "@/lib/follow-up-rules"
import { loadWorklist } from "@/lib/server/follow-ups"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const NOW = new Date("2026-11-22T12:00:00Z")
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString()
const ME = "33333333-3333-4333-8333-333333333333"
const lead = (o: Partial<RuleLead> = {}): RuleLead => ({ id: crypto.randomUUID(), ref: "E2B-ABC123", status: "nouveau", created_at: ago(10), assigned_to: ME, next_follow_up_at: null, last_activity_at: null, ...o })
const ctx = { now: NOW, activeStaffIds: new Set([ME]) }
const rules = (l: RuleLead) => evaluateLead(l, ctx).map((a) => a.rule)

describe("règles", () => {
  it("nouveau message : pas d'alerte avant le délai, urgente ensuite, escalade au responsable plus tard", () => {
    expect(rules(lead({ created_at: ago(DEFAULT_RULES.firstResponseMinutes - 1) }))).toEqual([])
    const a = evaluateLead(lead({ created_at: ago(DEFAULT_RULES.firstResponseMinutes + 1) }), ctx)
    expect(a).toHaveLength(1); expect(a[0]).toMatchObject({ rule: "new_unanswered", severity: "urgent", escalate: false })
    expect(evaluateLead(lead({ created_at: ago(DEFAULT_RULES.escalateAfterMinutes + 1) }), ctx)[0].escalate).toBe(true)
  })
  it("relance échue : alerte ; relance future : aucune", () => {
    expect(rules(lead({ status: "contacte", next_follow_up_at: ago(30) }))).toEqual(["overdue_followup"])
    expect(rules(lead({ status: "contacte", next_follow_up_at: new Date(NOW.getTime() + 3600_000).toISOString() }))).toEqual([])
  })
  it("devis sans réponse : relance proposée après 3 jours sans échange, pas avant, pas si une relance est déjà programmée", () => {
    const day = 24 * 60
    expect(rules(lead({ status: "devis", last_activity_at: ago(2 * day) }))).toEqual([])
    expect(rules(lead({ status: "devis", last_activity_at: ago(4 * day) }))).toEqual(["quote_no_answer"])
    expect(rules(lead({ status: "negociation", last_activity_at: null, created_at: ago(5 * day) }))).toEqual(["quote_no_answer"])
    expect(rules(lead({ status: "devis", last_activity_at: ago(4 * day), next_follow_up_at: new Date(NOW.getTime() + 86400_000).toISOString() }))).toEqual([])
  })
  it("conseiller absent : responsable inactif ou inconnu → réaffectation urgente à escalader ; sans responsable → alerte", () => {
    const gone = evaluateLead(lead({ status: "contacte", assigned_to: "99999999-9999-4999-8999-999999999999" }), ctx)
    expect(gone[0]).toMatchObject({ rule: "owner_inactive", severity: "urgent", escalate: true })
    expect(rules(lead({ status: "contacte", assigned_to: null }))).toEqual(["unassigned"])
  })
  it("client réserve / gagné / perdu : AUCUNE règle de conversion, relances arrêtées", () => {
    for (const status of ["reserve", "gagne", "perdu"]) {
      expect(rules(lead({ status, created_at: ago(9999), next_follow_up_at: ago(500), assigned_to: null }))).toEqual([])
      expect(shouldStopConversionFollowUps(status)).toBe(true)
    }
    expect(shouldStopConversionFollowUps("devis")).toBe(false)
  })
  it("liste de travail : urgents d'abord, puis les plus anciens ; plusieurs alertes possibles par dossier", () => {
    const a = lead({ ref: "E2B-AAAAAA", status: "contacte", next_follow_up_at: ago(10), created_at: ago(5000) })
    const b = lead({ ref: "E2B-BBBBBB", created_at: ago(90) }) // nouveau sans réponse : urgent
    const w = buildWorklist([a, b], ctx)
    expect(w[0]).toMatchObject({ ref: "E2B-BBBBBB", severity: "urgent" })
    expect(w.map((x) => x.rule)).toEqual(["new_unanswered", "overdue_followup"])
  })
  it("les alertes ne contiennent ni téléphone ni nom ni message du client", () => {
    const w = buildWorklist([lead({ created_at: ago(500) })], ctx)
    for (const a of w) expect(Object.keys(a).sort()).toEqual(["escalate", "leadId", "message", "ref", "rule", "severity", "suggestion"]) // seuls champs : aucun téléphone ni nom
  })
})

describe("chargement côté serveur", () => {
  const DB = "https://landing-db.test"
  let urls: string[], methods: string[]
  beforeEach(() => {
    configureAll(); resetTenantModeCache(); resetPublicOrgCache(); urls = []; methods = []
    vi.stubEnv("LANDING_SUPABASE_URL", DB)
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = decodeURIComponent(String(url)); urls.push(u); methods.push((init.method || "GET").toUpperCase())
      if (u.includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
      if (u.includes("/rest/v1/landing_leads")) return new Response(JSON.stringify([
        { id: "11111111-1111-4111-8111-111111111111", ref: "E2B-OLD111", status: "nouveau", created_at: ago(600), assigned_to: null, next_follow_up_at: null },
      ]), { status: 200 })
      if (u.includes("/rest/v1/landing_staff")) return new Response(JSON.stringify([{ user_id: ME, active: true }]), { status: 200 })
      return new Response("[]", { status: 200 })
    }))
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  it("lit sans écrire, exclut les leads de test et les dossiers anonymisés, ne demande ni téléphone ni nom", async () => {
    const w = await loadWorklist(NOW)
    expect(w.alerts.map((a) => a.rule).sort()).toEqual(["new_unanswered", "unassigned"])
    expect(methods.every((m) => m === "GET")).toBe(true)
    const leadReq = urls.find((u) => u.includes("/rest/v1/landing_leads"))!
    expect(leadReq).toContain("is_test=eq.false"); expect(leadReq).toContain("anonymized_at=is.null"); expect(leadReq).not.toMatch(/phone|first_name|message/)
  })
})
