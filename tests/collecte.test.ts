import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { qualifyLead, type LeadRow } from "@/lib/server/crm"
import { resetProtectionCache } from "@/lib/server/protection"
import { cleanEmail } from "@/lib/validation"
import { configureAll, installFetchMock, post } from "./helpers"

const actor = { id: "11111111-1111-4111-8111-111111111111", label: "direction@easy2book.tn" }
beforeEach(() => resetProtectionCache())
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("collecte : premier contact court (décisions du propriétaire)", () => {
  // un numéro différent par test : l'anti-doublon (même téléphone + produit, 10 min) est en mémoire du processus
  let n = 0
  const mk = (o: Record<string, unknown> = {}) => ({ name: "Ahmed Ben Ali", phone: `9814${String(1000 + ++n).slice(-4)}`, product: "omra", contactConsent: true, ...o })

  it("prénom + téléphone + produit suffisent ; rien n'est inventé (voyageurs, e-mail, région, budget)", async () => {
    configureAll()
    const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk()))
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, stored: true })
    const row = f.db.landing_leads[0]
    expect(row).toMatchObject({ first_name: "Ahmed", product: "omra", contact_channel: "whatsapp" })
    expect(row.adults).toBeNull()
    expect(row.children).toBeNull()
    expect(row.email).toBeNull()
    expect(row.region).toBeUndefined() // demandée pendant la qualification
    expect(row.budget).toBeNull() // jamais demandé au premier contact
    expect(decodeURIComponent(json.whatsappUrl)).not.toContain("Voyageurs")
    expect(decodeURIComponent(json.whatsappUrl)).toContain("Réf: E2B-")
  })

  it("le consentement de recontact reste obligatoire ; le numéro est validé et normalisé", async () => {
    configureAll()
    const f = installFetchMock()
    expect((await leadsPOST(post("/api/leads", mk({ contactConsent: false })))).status).toBe(422)
    expect((await leadsPOST(post("/api/leads", mk({ phone: "123" })))).status).toBe(422)
    expect((await leadsPOST(post("/api/leads", mk({ name: "" })))).status).toBe(422)
    expect(f.db.landing_leads).toHaveLength(0)
  })

  it("e-mail facultatif : valide = enregistré en minuscules, invalide = ignoré sans bloquer", async () => {
    configureAll()
    const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ email: "  Client@Example.TN " })))
    expect(f.db.landing_leads[0].email).toBe("client@example.tn")
    const bad = await leadsPOST(post("/api/leads", mk({ email: "pas-un-email" })))
    expect((await bad.json()).stored).toBe(true)
    expect(f.db.landing_leads[1].email).toBeNull()
    expect(cleanEmail("a@b")).toBeNull()
  })

  it("voyageurs : enregistrés et repris dans le message seulement s'ils sont donnés", async () => {
    configureAll()
    const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk({ adults: 3, children: 1 })))
    expect(f.db.landing_leads[0]).toMatchObject({ adults: 3, children: 1 })
    expect(decodeURIComponent((await res.json()).whatsappUrl)).toContain("Voyageurs : 3 adulte(s) + 1 enfant(s)")
  })

  it("budget et région envoyés par un client malveillant ne sont pas enregistrés au premier contact", async () => {
    configureAll()
    const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ region: "Sousse", budget: "9999 TND" })))
    expect(f.db.landing_leads[0].region).toBeUndefined()
  })

  it("base pas encore migrée (0006) : le lead n'est JAMAIS perdu (repli sans e-mail / canal, voyageurs historiques)", async () => {
    configureAll()
    const f = installFetchMock()
    const orig = globalThis.fetch
    const seen: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      if (String(url).endsWith("/rest/v1/landing_leads") && init.method === "POST") {
        const body = JSON.parse(String(init.body))
        seen.push(Object.keys(body).filter((k) => ["email", "contact_channel", "adults"].includes(k)).join(","))
        if ("email" in body || "contact_channel" in body) return new Response(JSON.stringify({ code: "PGRST204" }), { status: 400 })
        if (body.adults === null) return new Response(JSON.stringify({ code: "23502" }), { status: 400 })
      }
      return orig(url as string, init)
    }))
    const res = await leadsPOST(post("/api/leads", mk({ email: "client@example.tn" })))
    expect((await res.json()).stored).toBe(true)
    expect(f.db.landing_leads[0]).toMatchObject({ adults: 1, children: 0 })
    expect(f.db.landing_leads[0].email).toBeUndefined()
    expect(seen.length).toBeGreaterThanOrEqual(3)
  })
})

describe("qualification CRM (pendant le suivi)", () => {
  const lead = (o: Partial<LeadRow> = {}) => ({ id: "33333333-3333-4333-8333-333333333333", ref: "E2B-ABC234", first_name: "Ahmed", adults: null, children: null, region: null, email: null, budget: null, travel_period: null, contact_channel: "whatsapp", anonymized_at: null, ...o }) as LeadRow

  it("enregistre région, e-mail, budget déclaré, voyageurs et canal ; trace sans copier l'e-mail", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [lead()]
    const res = await qualifyLead(lead(), { region: "Sousse", email: "Client@Example.tn", budget: "5000 TND / pers.", adults: "2", children: "1", travel_period: "février 2027", contact_channel: "phone" }, actor)
    expect(res).toEqual({ ok: true })
    expect(f.db.landing_leads[0]).toMatchObject({ region: "Sousse", email: "client@example.tn", budget: "5000 TND / pers.", adults: 2, children: 1, travel_period: "février 2027", contact_channel: "phone" })
    const log = f.db.landing_lead_activities.at(-1)
    expect(log.type).toBe("note")
    expect(log.body).toContain("Qualification")
    expect(log.body).toContain("Région : Sousse")
    expect(log.body).toContain("Budget déclaré : 5000 TND / pers.")
    expect(log.body).toContain("E-mail renseigné")
    expect(log.body).not.toContain("example.tn")
  })

  it("refuse une région inconnue, un e-mail invalide, des nombres hors bornes, un canal inconnu — sans rien écrire", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [lead()]
    for (const bad of [{ region: "Atlantide" }, { email: "x" }, { adults: "0" }, { adults: "abc" }, { children: "99" }, { contact_channel: "pigeon" }]) {
      expect((await qualifyLead(lead(), bad, actor)).ok).toBe(false)
    }
    expect(f.dbCalls().filter((c) => c.method !== "GET")).toHaveLength(0)
  })

  it("champ vide = effacé ; aucun changement = aucune écriture ; lead anonymisé = verrouillé", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [lead({ region: "Sfax" })]
    expect((await qualifyLead(lead({ region: "Sfax" }), { region: "" }, actor)).ok).toBe(true)
    expect(f.db.landing_leads[0].region).toBeNull()
    const writes = f.dbCalls().filter((c) => c.method !== "GET").length
    expect((await qualifyLead(lead(), { region: "", budget: "" }, actor)).ok).toBe(true)
    expect(f.dbCalls().filter((c) => c.method !== "GET").length).toBe(writes)
    expect((await qualifyLead(lead({ anonymized_at: "2026-01-01" }), { region: "Tunis" }, actor)).ok).toBe(false)
  })
})

describe("garde-fou : le formulaire public du premier contact reste court", () => {
  const src = readFileSync(new URL("../app/components/LeadCaptureForm.tsx", import.meta.url), "utf8")
  it("n'expose ni budget, ni région, ni type de séjour, ni âge", () => {
    for (const forbidden of ['name="budget"', 'name="region"', 'name="trip_type"', 'name="age"', "budgets"]) expect(src).not.toContain(forbidden)
  })
  it("voyageurs et e-mail seulement sur demande explicite de la page (props, faux par défaut)", () => {
    expect(src).toMatch(/askTravelers = false/)
    expect(src).toMatch(/askEmail = false/)
  })
})
