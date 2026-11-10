import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const notify = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: notify }))

import { ingestExternalLead, inboundKey, type InboundLeadInput } from "@/lib/server/inbound-leads"
import { DEFAULT_ORG_ID } from "@/lib/org-id"
import { configureAll, installFetchMock } from "./helpers"

// NB : les charges de ces tests sont SIMULÉES. Aucune plateforme (Meta, TikTok, WhatsApp) n'a été contactée :
// ces tests prouvent le comportement du service, pas la réception réelle d'un lead.
const OTHER_ORG = "5e0d7c1a-3b2f-4d6e-8a9b-0c1d2e3f4a5b"
const base: InboundLeadInput = { platform: "facebook", externalId: "444455556666", name: "Sami Ben Ali", phone: "98 140 514", contactConsent: true }

beforeEach(() => { configureAll(); notify.mockClear() })
afterEach(() => vi.unstubAllEnvs())

describe("clé d'idempotence", () => {
  it("combine la plateforme et l'identifiant externe, refuse les valeurs suspectes", () => {
    expect(inboundKey("facebook", "444455556666")).toBe("facebook:444455556666")
    expect(inboundKey("tiktok", "L-123_abc")).toBe("tiktok:L-123_abc")
    expect(inboundKey("facebook", "")).toBeNull()
    expect(inboundKey("facebook", "a b")).toBeNull()
    expect(inboundKey("facebook", "x".repeat(101))).toBeNull()
  })
})

describe("enregistrement d'un lead externe", () => {
  it("crée UN prospect avec source, consentement de recontact, sans identifiant publicitaire personnel", async () => {
    const f = installFetchMock()
    const r = await ingestExternalLead(DEFAULT_ORG_ID, { ...base, email: "Sami@Example.com", offer: "Omra 2027", formId: "F1", campaignId: "C9", adsetId: "S3", adId: "A7" })
    expect(r).toMatchObject({ ok: true, duplicate: false })
    expect(f.db.landing_leads).toHaveLength(1)
    const row = f.db.landing_leads[0]
    expect(row).toMatchObject({
      idempotency_key: "facebook:444455556666", first_name: "Sami", last_name: "Ben Ali", phone: "21698140514", product: "autre", email: "sami@example.com",
      channel: "meta", first_channel: "meta", utm_source: "facebook", utm_medium: "formulaire_instantane",
      campaign_id: "C9", adset_id: "S3", ad_id: "A7", offer: "Omra 2027",
      contact_consent: true, marketing_consent: false, tracking_consent: false,
    })
    for (const k of ["fbclid", "ttclid", "fbp", "fbc", "ttp", "ip", "user_agent", "visitor_id"]) expect(row[k]).toBeUndefined()
  })

  it("canal par plateforme : Instagram → meta, TikTok → tiktok, WhatsApp → whatsapp (message entrant)", async () => {
    const f = installFetchMock()
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, platform: "instagram", externalId: "ig-0001", phone: "22 123 456" })
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, platform: "tiktok", externalId: "tt-0001", phone: "55 123 456" })
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, platform: "whatsapp", externalId: "wamid.HBgL", phone: "29 123 456" })
    const by = (k: string) => f.db.landing_leads.find((r) => r.idempotency_key === k)!
    expect(by("instagram:ig-0001")).toMatchObject({ channel: "meta", utm_source: "instagram" })
    expect(by("tiktok:tt-0001")).toMatchObject({ channel: "tiktok", utm_source: "tiktok" })
    expect(by("whatsapp:wamid.HBgL")).toMatchObject({ channel: "whatsapp", utm_medium: "message_entrant" })
  })

  it("même événement externe reçu deux fois : un seul prospect, même référence", async () => {
    const f = installFetchMock()
    const a = await ingestExternalLead(DEFAULT_ORG_ID, base)
    const b = await ingestExternalLead(DEFAULT_ORG_ID, base)
    expect(a.ok && b.ok).toBe(true)
    expect(b).toMatchObject({ ok: true, duplicate: true })
    expect(b.ok && a.ok && b.ref).toBe(a.ok && a.ref)
    expect(f.db.landing_leads).toHaveLength(1)
  })

  it("même téléphone le même jour avec un autre identifiant : pas de second prospect", async () => {
    const f = installFetchMock()
    await ingestExternalLead(DEFAULT_ORG_ID, base)
    const again = await ingestExternalLead(DEFAULT_ORG_ID, { ...base, externalId: "999900001111" })
    expect(again).toMatchObject({ ok: true, duplicate: true })
    expect(f.db.landing_leads).toHaveLength(1)
  })

  it("sans consentement de recontact : refusé, rien n'est enregistré", async () => {
    const f = installFetchMock()
    const r = await ingestExternalLead(DEFAULT_ORG_ID, { ...base, contactConsent: false })
    expect(r).toEqual({ ok: false, reason: "no_consent" })
    expect(f.db.landing_leads ?? []).toHaveLength(0)
  })

  it("données invalides : prénom trop court, téléphone invalide, e-mail invalide, identifiant externe suspect, entreprise invalide", async () => {
    const f = installFetchMock()
    expect(await ingestExternalLead(DEFAULT_ORG_ID, { ...base, name: "S" })).toMatchObject({ ok: false, reason: "invalid", errors: { name: expect.any(String) } })
    expect(await ingestExternalLead(DEFAULT_ORG_ID, { ...base, phone: "12" })).toMatchObject({ ok: false, reason: "invalid", errors: { phone: expect.any(String) } })
    expect(await ingestExternalLead(DEFAULT_ORG_ID, { ...base, email: "pas-un-email" })).toMatchObject({ ok: false, reason: "invalid", errors: { email: expect.any(String) } })
    expect(await ingestExternalLead(DEFAULT_ORG_ID, { ...base, externalId: "a b;c" })).toMatchObject({ ok: false, reason: "invalid", errors: { externalId: expect.any(String) } })
    expect(await ingestExternalLead("pas-un-uuid", base)).toMatchObject({ ok: false, reason: "invalid" })
    expect(f.db.landing_leads ?? []).toHaveLength(0)
  })

  it("l'historique « created » mentionne la plateforme et l'identifiant externe", async () => {
    const f = installFetchMock()
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, formId: "F1" })
    const act = f.db.landing_lead_activities.at(-1)!
    expect(act.type).toBe("created")
    expect(String(act.body)).toMatch(/Facebook/)
    expect(String(act.body)).toMatch(/444455556666/)
  })

  it("notification d'équipe : seulement si demandée ET pour l'organisation d'Easy2Book", async () => {
    installFetchMock()
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, notifyTeam: true })
    expect(notify).toHaveBeenCalledTimes(1)
    notify.mockClear()
    await ingestExternalLead(OTHER_ORG, { ...base, externalId: "777788889999", phone: "22 765 432", notifyTeam: true })
    expect(notify).not.toHaveBeenCalled()
    await ingestExternalLead(DEFAULT_ORG_ID, { ...base, externalId: "111122223333", phone: "55 765 432" })
    expect(notify).not.toHaveBeenCalled()
  })

  it("base indisponible : erreur explicite, aucun faux succès", async () => {
    vi.stubEnv("LANDING_SUPABASE_URL", "")
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "")
    const r = await ingestExternalLead(DEFAULT_ORG_ID, base)
    expect(r.ok).toBe(false)
  })
})
