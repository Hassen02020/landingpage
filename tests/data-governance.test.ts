// Gouvernance des données (migration 0026) : lead de test, motif de perte, produit acheté, exclusion des analyses.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { changeStatus, setTestFlag, type LeadRow } from "@/lib/server/crm"
import { LOSS_REASONS, LOSS_REASON_LABELS, isLossReason } from "@/lib/governance"
import { __resetLeadScope, selectRealLeads } from "@/lib/server/lead-scope"
import { DbError, resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll, installFetchMock } from "./helpers"

const actor = { id: "11111111-1111-1111-1111-111111111111", label: "manager@easy2book.tn" }
function seedLead(f: ReturnType<typeof installFetchMock>, o: Partial<LeadRow> = {}): LeadRow {
  const lead = {
    id: crypto.randomUUID(), created_at: new Date().toISOString(), ref: "E2B-ABC234", visitor_ref: null, first_name: "Sana", last_name: null,
    phone: "21655123456", product: "omra", offer: null, niche: null, destination: null, travel_date: null, travel_period: null,
    adults: 2, children: 0, budget: null, message: null, status: "nouveau", booking_value: null, booked_at: null, notes: null,
    marketing_consent: true, tracking_consent: false, channel: "meta", utm_source: null, utm_campaign: null, utm_content: null, ad_id: null,
    landing_page: null, visitor_id: null, fbp: null, fbc: null, ttp: null, ttclid: null, ip: null, user_agent: null, ...o,
  } as LeadRow
  f.db.landing_leads.push({ ...lead })
  return lead
}
beforeEach(() => { configureAll(); __resetLeadScope(); resetTenantModeCache(); resetPublicOrgCache() })
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe("listes contrôlées", () => {
  it("chaque motif de perte a un libellé ; les valeurs inconnues sont refusées", () => {
    for (const r of LOSS_REASONS) expect(LOSS_REASON_LABELS[r]).toBeTruthy()
    expect(LOSS_REASONS).toHaveLength(9)
    expect(isLossReason("prix")).toBe(true)
    expect(isLossReason("parce que")).toBe(false)
    expect(isLossReason(undefined)).toBe(false)
  })
})

describe("motif de perte et produit acheté (changeStatus)", () => {
  it("perdu avec motif : motif enregistré ; le motif est facultatif", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    expect((await changeStatus(lead, "perdu", actor, { lostReason: "prix" })).ok).toBe(true)
    expect(f.db.landing_leads[0]).toMatchObject({ status: "perdu", lost_reason: "prix" })
    const g = installFetchMock(); const l2 = seedLead(g)
    expect((await changeStatus(l2, "perdu", actor)).ok).toBe(true)
    expect(g.db.landing_leads[0].lost_reason).toBeUndefined()
  })

  it("motif invalide ou produit acheté invalide : refusé, rien n'est écrit", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    expect(await changeStatus(lead, "perdu", actor, { lostReason: "parce que" })).toEqual({ ok: false, error: "Motif de perte invalide" })
    expect(await changeStatus(lead, "reserve", actor, { bookingValue: 100, purchasedProduct: "croisiere" })).toEqual({ ok: false, error: "Produit acheté invalide" })
    expect(f.db.landing_leads[0].status).toBe("nouveau")
  })

  it("le motif est effacé quand le lead quitte « perdu » ; il n'est jamais écrit sur un autre statut", async () => {
    const f = installFetchMock(); let lead = seedLead(f, { status: "perdu", lost_reason: "concurrence" } as Partial<LeadRow>)
    expect((await changeStatus(lead, "contacte", actor, { lostReason: "prix" })).ok).toBe(true)
    expect(f.db.landing_leads[0].lost_reason).toBeNull()
    expect(f.db.landing_leads[0].status).toBe("contacte")
    lead = seedLead(f)
    await changeStatus(lead, "qualifie", actor, { lostReason: "prix" })
    expect(f.db.landing_leads[1].lost_reason).toBeUndefined()
  })

  it("réservation : produit acheté enregistré (peut différer du produit demandé) ; absent sur un statut ouvert", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    expect((await changeStatus(lead, "reserve", actor, { bookingValue: 3200, purchasedProduct: "hotel" })).ok).toBe(true)
    expect(f.db.landing_leads[0]).toMatchObject({ product: "omra", purchased_product: "hotel", status: "reserve" })
    const g = installFetchMock(); const l2 = seedLead(g)
    await changeStatus(l2, "contacte", actor, { purchasedProduct: "hotel" })
    expect(g.db.landing_leads[0].purchased_product).toBeUndefined()
  })

  it("base NON migrée : le statut est enregistré quand même, sans les colonnes de gouvernance", async () => {
    const calls: { method: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init: RequestInit = {}) => {
      if (String(_u).includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
      const method = (init.method || "GET").toUpperCase()
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
      calls.push({ method, body })
      if (method === "PATCH" && ("lost_reason" in body || "purchased_product" in body)) return new Response(JSON.stringify({ code: "42703", message: "column does not exist" }), { status: 400 })
      return new Response(JSON.stringify([{ id: "x" }]), { status: 200 })
    }))
    const lead = { id: crypto.randomUUID(), status: "nouveau", product: "omra", phone: null, booking_value: null, booked_at: null, tracking_consent: false, first_name: "A" } as unknown as LeadRow
    expect((await changeStatus(lead, "perdu", actor, { lostReason: "prix" })).ok).toBe(true)
    const patches = calls.filter((c) => c.method === "PATCH")
    expect(patches.length).toBe(2)
    expect(patches[0].body).toHaveProperty("lost_reason")
    expect(patches[1].body).not.toHaveProperty("lost_reason")
    expect(patches[1].body).toMatchObject({ status: "perdu" })
  })
})

describe("setTestFlag : marquer un lead de test", () => {
  it("marque, puis démarque, avec une trace dans l'historique", async () => {
    const f = installFetchMock(); const lead = seedLead(f)
    expect(await setTestFlag(lead, true, actor)).toEqual({ ok: true })
    expect(f.db.landing_leads[0].is_test).toBe(true)
    expect(f.db.landing_lead_activities.at(-1)).toMatchObject({ type: "note", actor_label: actor.label })
    expect(String(f.db.landing_lead_activities.at(-1)!.body)).toMatch(/TEST/)
    expect(await setTestFlag(lead, false, actor)).toEqual({ ok: true })
    expect(f.db.landing_leads[0].is_test).toBe(false)
  })
  it("lead anonymisé : refusé ; migration non appliquée : message clair, aucune exception", async () => {
    const f = installFetchMock()
    expect(await setTestFlag(seedLead(f, { anonymized_at: "2026-11-01T00:00:00Z" } as Partial<LeadRow>), true, actor)).toEqual({ ok: false, error: "Lead anonymisé : modification impossible" })
    vi.stubGlobal("fetch", vi.fn(async (u: unknown) => (String(u).includes("/rest/v1/organizations?") ? new Response("[]", { status: 200 }) : new Response(JSON.stringify({ code: "42703" }), { status: 400 }))))
    const r = await setTestFlag({ id: crypto.randomUUID() } as LeadRow, true, actor)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/0026/)
  })
})

describe("selectRealLeads : les tests sont exclus des analyses", () => {
  const stub = (h: (u: string) => Response) => vi.stubGlobal("fetch", vi.fn(async (u: unknown) => (String(u).includes("/rest/v1/organizations?") ? new Response("[]", { status: 200 }) : h(String(u)))))
  const urls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => decodeURIComponent(String(c[0]))).filter((u) => u.includes("landing_leads"))
  it("ajoute le filtre is_test=eq.false", async () => {
    stub(() => new Response(JSON.stringify([{ id: "a" }]), { status: 200 }))
    expect(await selectRealLeads("select=id&limit=5")).toEqual([{ id: "a" }])
    expect(urls()[0]).toMatch(/landing_leads\?select=id&limit=5&is_test=eq\.false$/)
  })
  it("base non migrée (42703) : relit sans filtre, puis ne retente le filtre qu'après 1 minute", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-20T10:00:00Z"))
    let migrated = false
    stub((u) => (u.includes("is_test") && !migrated ? new Response(JSON.stringify({ code: "42703", message: "column landing_leads.is_test does not exist" }), { status: 400 }) : new Response(JSON.stringify([{ id: "a" }]), { status: 200 })))
    await selectRealLeads("select=id")
    const first = urls().length
    expect(first).toBe(2) // essai filtré refusé, puis lecture sans filtre
    await selectRealLeads("select=id")
    expect(urls().length).toBe(first + 1) // pas de nouvel essai filtré pendant la minute
    migrated = true
    vi.setSystemTime(new Date("2026-11-20T10:01:30Z"))
    await selectRealLeads("select=id")
    expect(urls().at(-1)).toMatch(/is_test=eq\.false$/) // la migration est reprise sans redémarrage
    await selectRealLeads("select=id")
    expect(urls().at(-1)).toMatch(/is_test=eq\.false$/)
  })
  it("une AUTRE colonne manquante (42703 sans is_test) est propagée et ne désactive PAS l'exclusion des tests", async () => {
    stub((u) => (u.includes("age_range") ? new Response(JSON.stringify({ code: "42703", message: "column landing_leads.age_range does not exist" }), { status: 400 }) : new Response(JSON.stringify([{ id: "a" }]), { status: 200 })))
    await expect(selectRealLeads("select=id,age_range")).rejects.toBeInstanceOf(DbError)
    await selectRealLeads("select=id")
    expect(urls().at(-1)).toMatch(/is_test=eq\.false$/) // le filtre est toujours appliqué
  })
  it("toute autre erreur est propagée (jamais masquée)", async () => {
    stub(() => new Response(JSON.stringify({ code: "XX000" }), { status: 500 }))
    await expect(selectRealLeads("select=id")).rejects.toBeInstanceOf(DbError)
  })
})

describe("garde-fou : aucune analyse ne lit les leads sans exclure les tests", () => {
  const dir = new URL("../lib/server/", import.meta.url)
  // fichiers autorisés à lire landing_leads directement : recherches opérationnelles (par référence, téléphone, identifiant),
  // fiche et liste de travail des conseillers (les tests y restent visibles et marqués), relance des conversions (lit aussi les leads de test pour les ÉCARTER), recherche de doublon à la réception d'un lead
  // (un test et un vrai lead du même numéro restent des doublons), et le chargeur de qualité (gère is_test lui-même).
  const ALLOWED = new Set(["ad-spend.ts", "catalog.ts", "commissions.ts", "conversions.ts", "crm.ts", "customer.ts", "inbound-leads.ts", "intelligence.ts", "lead-intake.ts", "lead-scope.ts", "variable-costs.ts"])
  it("un fichier serveur qui lit directement landing_leads doit être déclaré ici (décision explicite : test visible ou exclu)", () => {
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !ALLOWED.has(f))
      .filter((f) => /select(<[^>]*>)?\(\s*"landing_leads"/.test(readFileSync(new URL(f, dir), "utf8")))
    expect(offenders).toEqual([])
  })
  it("les analyses (statistiques, entonnoir, rentabilité, WhatsApp, tableau de bord, export, liste des clients) passent par selectRealLeads", () => {
    for (const f of ["stats.ts", "analytics.ts", "profitability.ts", "whatsapp-stats.ts", "dashboard.ts", "export.ts", "customer.ts"]) {
      expect(readFileSync(new URL(f, dir), "utf8"), f).toContain("selectRealLeads")
    }
  })
  it("customer.ts : seule la fiche d'un client (par téléphone) lit les leads sans filtre ; listes et segments excluent les tests", () => {
    const src = readFileSync(new URL("customer.ts", dir), "utf8")
    expect((src.match(/selectRealLeads</g) ?? []).length).toBe(2)
    expect((src.match(/select<LeadRow>\("landing_leads"/g) ?? []).length).toBe(1)
  })
})
