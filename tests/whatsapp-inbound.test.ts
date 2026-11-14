import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHmac } from "node:crypto"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: vi.fn(async () => undefined) }))

import { handleWhatsAppGet, handleWhatsAppPost, parseWhatsAppPayload } from "@/lib/server/whatsapp-inbound"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

// NB : toute la plateforme WhatsApp est SIMULÉE ici (charges Cloud API). Ces tests prouvent le comportement du code,
// PAS la réception d'un message réel : aucun compte WhatsApp Business n'a été contacté.
const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const SECRET = "whatsapp-app-secret-de-test-0123456789"
const NUM_E2B = "200000000000001"
const NUM_BOB = "200000000000002"
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex")

const message = (over: Record<string, unknown> = {}, numberId = NUM_E2B, name = "Amine Gharbi") =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "21698140514", phone_number_id: numberId }, contacts: [{ wa_id: "21622123456", profile: { name } }], messages: [{ from: "21622123456", id: "wamid.AAA111", timestamp: "1794350000", type: "text", text: { body: "Bonjour Easy2Book Réf: E2B-ABC123 je veux la Omra de Ramadan" }, ...over }] } }] }],
  })

interface World { leads: Record<string, unknown>[]; activities: { lead: string; type: string; body: string }[]; events: Record<string, unknown>[]; numbers: Record<string, unknown>[]; clicks: Record<string, unknown>[]; failLeads: boolean }
let w: World

function install() {
  w = { leads: [], activities: [], events: [], numbers: [{ phone_number_id: NUM_E2B, organization_id: E2B, enabled: true }, { phone_number_id: NUM_BOB, organization_id: BOB, enabled: true }], clicks: [], failLeads: false }
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json([{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body))
      if (table === "landing_leads") {
        if (w.failLeads) return json({ code: "XX000" }, 500)
        const dup = w.leads.some((l) => l.organization_id === body.organization_id && (l.idempotency_key === body.idempotency_key || (l.phone === body.phone && l.product === body.product)))
        if (dup) return json({ code: "23505" }, 409)
        w.leads.push({ ...body, id: "lead-" + (w.leads.length + 1) })
        return json([{ id: "lead-" + w.leads.length }], 201)
      }
      if (table === "landing_lead_activities") { w.activities.push({ lead: body.lead_id, type: body.type, body: String(body.body ?? "") }); return json([], 201) }
      if (table === "landing_inbound_events") { w.events.push(body); return json([], 201) }
      return json([], 201)
    }
    if (table === "landing_whatsapp_numbers") return json(w.numbers.filter((n) => n.phone_number_id === dec.match(/phone_number_id=eq\.(\d+)/)?.[1]))
    if (table === "landing_inbound_events") {
      const id = dec.match(/external_id=eq\.([^&]+)/)?.[1]
      return json(w.events.filter((e) => e.external_id === id && (e.status === "created" || e.status === "duplicate")).map(() => ({ id: 1 })))
    }
    if (table === "landing_events") return json(w.clicks)
    if (table === "landing_leads") {
      const byRef = dec.match(/[&?]ref=eq\.([A-Z0-9-]+)/)?.[1]
      const byVisitor = dec.match(/visitor_ref=eq\.([A-Z0-9-]+)/)?.[1]
      const hit = w.leads.filter((l) => (byRef && l.ref === byRef) || (byVisitor && l.visitor_ref === byVisitor))
      if (byRef || byVisitor) return json(hit.map((l) => ({ id: l.id, ref: l.ref, first_name: l.first_name, status: "new", anonymized_at: null })))
      return json(w.leads.map((l) => ({ ref: l.ref, id: l.id, idempotency_key: l.idempotency_key })))
    }
    return json([])
  }))
}

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET)
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "jeton-wa")
  resetTenantModeCache(); resetPublicOrgCache()
  install()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const post = (body: string, sig = sign(body)) => handleWhatsAppPost(body, sig)

describe("analyse de la charge", () => {
  it("extrait les messages texte ; ignore statuts, charges d'un autre objet et identifiants invalides", () => {
    const [m] = parseWhatsAppPayload(JSON.parse(message()))
    expect(m).toMatchObject({ phoneNumberId: NUM_E2B, wamid: "wamid.AAA111", from: "21622123456", type: "text", profileName: "Amine Gharbi" })
    expect(m.text).toContain("E2B-ABC123")
    expect(parseWhatsAppPayload({ object: "page", entry: [] })).toEqual([])
    expect(parseWhatsAppPayload({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: NUM_E2B }, statuses: [{ id: "x", status: "read" }] } }] }] })).toEqual([])
    expect(parseWhatsAppPayload(JSON.parse(message({ id: "x" })))).toEqual([])
    expect(parseWhatsAppPayload(null)).toEqual([])
  })
})

describe("route : inerte, signée", () => {
  it("404 tant que le jeton ou le secret ne sont pas définis", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", ""); vi.stubEnv("WHATSAPP_APP_SECRET", ""); vi.stubEnv("META_APP_SECRET", "")
    expect(handleWhatsAppGet(new URLSearchParams("hub.mode=subscribe&hub.verify_token=x&hub.challenge=1")).status).toBe(404)
    expect((await post(message())).status).toBe(404)
    expect(w.leads).toHaveLength(0)
  })
  it("vérification d'abonnement : bon jeton → challenge ; mauvais → 403", () => {
    expect(handleWhatsAppGet(new URLSearchParams("hub.mode=subscribe&hub.verify_token=jeton-wa&hub.challenge=12345"))).toMatchObject({ status: 200, body: "12345" })
    expect(handleWhatsAppGet(new URLSearchParams("hub.mode=subscribe&hub.verify_token=faux&hub.challenge=12345")).status).toBe(403)
  })
  it("signature absente, fausse ou calculée sur un autre corps → 401, rien d'enregistré", async () => {
    const body = message()
    expect((await handleWhatsAppPost(body, null)).status).toBe(401)
    expect((await handleWhatsAppPost(body, "sha256=" + "0".repeat(64))).status).toBe(401)
    expect((await handleWhatsAppPost(body, sign(body + " "))).status).toBe(401)
    expect(w.leads).toHaveLength(0)
    expect(w.events).toHaveLength(0)
  })
  it("le secret Meta commun sert de repli quand WHATSAPP_APP_SECRET est absent", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", ""); vi.stubEnv("META_APP_SECRET", SECRET)
    expect((await post(message({ text: { body: "Bonjour" } }))).status).toBe(200)
    expect(w.leads).toHaveLength(1)
  })
})

describe("traitement d'un message", () => {
  it("sans référence : crée un lead WhatsApp dans l'entreprise du numéro, sans conserver le texte", async () => {
    const body = message({ text: { body: "Bonjour, je cherche une Omra en famille, mon budget est de 9000 TND" } })
    const r = await post(body)
    expect(r.status).toBe(200)
    expect(w.leads).toHaveLength(1)
    const l = w.leads[0]
    expect(l).toMatchObject({ organization_id: E2B, phone: "21622123456", first_name: "Amine", channel: "whatsapp", utm_source: "whatsapp", utm_medium: "message_entrant", contact_consent: true, marketing_consent: false, tracking_consent: false, idempotency_key: "whatsapp:wamid.AAA111" })
    expect(JSON.stringify(w.leads)).not.toContain("9000")
    expect(JSON.stringify(w.activities)).not.toContain("9000")
    expect(l.message ?? null).toBeNull()
    expect(w.activities.some((a) => a.type === "created" && a.body.includes("origine inconnue"))).toBe(true)
    expect(w.events).toEqual([expect.objectContaining({ platform: "whatsapp", external_id: "wamid.AAA111", source_ref: NUM_E2B, status: "created" })])
  })
  it("le même message rejoué ne crée pas un second lead", async () => {
    const body = message({ text: { body: "Bonjour" } })
    await post(body); await post(body)
    expect(w.leads).toHaveLength(1)
    expect(w.events.map((e) => e.status)).toEqual(["created", "duplicate"])
  })
  it("référence d'un lead existant : message rattaché à son historique, aucun doublon, texte non conservé", async () => {
    w.leads.push({ id: "lead-existant", ref: "E2B-ABC123", organization_id: E2B, first_name: "Amine", phone: "21622123456", product: "omra" })
    const r = await post(message())
    expect(r.status).toBe(200)
    expect(w.leads).toHaveLength(1)
    expect(w.activities).toEqual([expect.objectContaining({ lead: "lead-existant", type: "wa_in" })])
    expect(w.activities[0].body).toContain("E2B-ABC123")
    expect(w.activities[0].body).not.toContain("Omra de Ramadan")
    expect(w.events[0]).toMatchObject({ status: "duplicate", reason: "rattache_lead_existant" })
  })
  it("rejeu du même message rattaché : une seule ligne d'historique", async () => {
    w.leads.push({ id: "lead-existant", ref: "E2B-ABC123", organization_id: E2B, first_name: "Amine", phone: "21622123456", product: "omra" })
    await post(message()); await post(message())
    expect(w.activities).toHaveLength(1)
  })
  it("référence d'un clic connu : le lead garde l'origine (canal, campagne, annonce) et la référence", async () => {
    w.clicks = [{ created_at: "2026-11-10T10:00:00Z", location: "hero", product: "omra", offer: null, niche: null, channel: "meta", utm_source: "facebook", utm_campaign: "omra_ramadan", utm_content: "video1", ad_id: "7001" }]
    await post(message())
    expect(w.leads[0]).toMatchObject({ channel: "meta", utm_source: "facebook", utm_campaign: "omra_ramadan", utm_content: "video1", ad_id: "7001", visitor_ref: "E2B-ABC123" })
    expect(w.activities.find((a) => a.type === "created")!.body).toContain("rattaché au clic")
  })
  it("nom absent ou trop court : « Contact WhatsApp » ; numéro étranger accepté", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: NUM_E2B }, messages: [{ from: "33612345678", id: "wamid.ZZZ999", type: "text", text: { body: "Hello" } }] } }] }] })
    await post(body)
    expect(w.leads[0]).toMatchObject({ first_name: "Contact", phone: "33612345678" })
  })
  it("numéro inconnu ou désactivé : aucun lead ; désactivé → issue journalisée", async () => {
    expect((await post(message({}, "299999999999999"))).status).toBe(200)
    expect(w.leads).toHaveLength(0)
    expect(w.events).toHaveLength(0) // aucune entreprise connue : rien en base
    w.numbers[0].enabled = false
    await post(message())
    expect(w.leads).toHaveLength(0)
    expect(w.events[0]).toMatchObject({ status: "ignored", reason: "numero_desactive" })
  })
  it("images, vocaux : pas de lead", async () => {
    await post(message({ type: "image", text: undefined, image: { id: "1" } }))
    expect(w.leads).toHaveLength(0)
    expect(w.events[0]).toMatchObject({ status: "ignored", reason: "type_image" })
  })
  it("cloisonnement : le message du numéro de Bob n'atteint que Bob", async () => {
    await post(message({ text: { body: "Salut" } }, NUM_BOB))
    expect(w.leads.map((l) => l.organization_id)).toEqual([BOB])
    expect(w.events[0]).toMatchObject({ source_ref: NUM_BOB })
  })
  it("panne de la base → 500 (Meta rejoue), puis le rejeu aboutit sans doublon", async () => {
    w.failLeads = true
    const body = message({ text: { body: "Bonjour" } })
    expect((await post(body)).status).toBe(500)
    expect(w.events[0]).toMatchObject({ status: "retry" })
    w.failLeads = false
    expect((await post(body)).status).toBe(200)
    expect(w.leads).toHaveLength(1)
  })
})
