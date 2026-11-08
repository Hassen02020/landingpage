import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const notify = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: notify }))

import { handleLeadPost } from "@/lib/server/lead-intake"
import { __resetGuards } from "@/lib/server/guard"
import { defaultFormConfig, type FormConfig } from "@/lib/form-config"
import { configureAll, installFetchMock, post } from "./helpers"

const config: FormConfig = {
  ...defaultFormConfig(),
  fields: { email: { enabled: true, required: true }, message: { enabled: false, required: false }, offer: { enabled: true, required: false }, budget: { enabled: false, required: false } },
  custom: [{ key: "c1", label: "Ville", required: true }],
}
const base = { eventId: "org-evt-00001", name: "Zied Client", phone: "98 140 514", contactConsent: true, trackingConsent: false, marketingConsent: false }

beforeEach(() => { __resetGuards(); configureAll(); notify.mockClear() })
afterEach(() => vi.unstubAllEnvs())

describe("collecte d'une entreprise cliente (platform: false)", () => {
  it("champs obligatoires de SA configuration : refus 422 avec les erreurs par champ", async () => {
    installFetchMock()
    const res = await handleLeadPost(post("/api/o/bob/leads", base), { platform: false, orgSlug: "bob", formConfig: config })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toMatchObject({ email: "E-mail requis", c1: "Ville requis" })
  })

  it("lead enregistré avec ses champs personnalisés ; aucun produit ni destination d'Easy2Book ; champ désactivé ignoré", async () => {
    const f = installFetchMock()
    const res = await handleLeadPost(post("/api/o/bob/leads", { ...base, email: "z@bob.tn", offer: "Pack Pro", message: "ignoré", budget: "9999", product: "omra", destination: "Mecque", custom: { c1: "Tunis", c9: "intrus" } }), { platform: false, orgSlug: "bob", formConfig: config })
    expect(res.status).toBe(200)
    const row = f.db.landing_leads[0]
    expect(row).toMatchObject({ product: "autre", email: "z@bob.tn", offer: "Pack Pro", custom_fields: { c1: "Tunis" }, destination: null, message: null, budget: null })
  })

  it("jamais le numéro WhatsApp d'Easy2Book ni la notification d'équipe d'Easy2Book", async () => {
    installFetchMock()
    const res = await handleLeadPost(post("/api/o/bob/leads", { ...base, email: "z@bob.tn", custom: { c1: "Tunis" } }), { platform: false, orgSlug: "bob", formConfig: config })
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.whatsappUrl).toBeNull()
    expect(JSON.stringify(json)).not.toMatch(/wa\.me|216/)
    expect(notify).not.toHaveBeenCalled()
  })

  it("la limitation de débit est PAR entreprise (l'abus chez l'une ne bloque pas l'autre)", async () => {
    installFetchMock()
    const mk = (n: number) => post("/api/o/x/leads", { ...base, eventId: `evt-rate-${n}0000`, phone: `9814${n}000`, email: "z@x.tn", custom: { c1: "T" } }, { "x-forwarded-for": "9.9.9.9" })
    for (let i = 0; i < 5; i++) expect((await handleLeadPost(mk(i), { platform: false, orgSlug: "a", formConfig: config })).status).toBe(200)
    expect((await handleLeadPost(mk(7), { platform: false, orgSlug: "a", formConfig: config })).status).toBe(429)
    expect((await handleLeadPost(mk(8), { platform: false, orgSlug: "b", formConfig: config })).status).toBe(200)
  })
})

describe("site public d'Easy2Book (platform: true) : comportement inchangé", () => {
  it("garde son numéro WhatsApp, sa notification d'équipe et ses produits", async () => {
    const f = installFetchMock()
    const res = await handleLeadPost(post("/api/leads", { ...base, product: "voyage", destination: "Istanbul" }), { platform: true })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.whatsappUrl).toMatch(/^https:\/\/wa\.me\//)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(f.db.landing_leads[0]).toMatchObject({ product: "voyage", destination: "Istanbul" })
  })
})
