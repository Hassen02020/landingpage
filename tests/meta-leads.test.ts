import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHmac } from "node:crypto"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: vi.fn(async () => undefined) }))

import { handleMetaLeadsGet, handleMetaLeadsPost, mapFieldData, parseLeadgenPayload } from "@/lib/server/meta-leads"
import { seal } from "@/lib/server/secret-box"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

// NB : toute la plateforme Meta est SIMULÉE ici (API Graph, charges). Ces tests prouvent le comportement du code,
// PAS la réception d'un lead réel : aucun compte Meta n'a été contacté.
const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const APP_SECRET = "meta-app-secret-de-test-0123456789"
const PAGE_E2B = "100000000000001"
const PAGE_BOB = "100000000000002"

const sign = (body: string) => "sha256=" + createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")
const payload = (leadgenId: string, pageId = PAGE_E2B) => JSON.stringify({ object: "page", entry: [{ id: pageId, time: 1, changes: [{ field: "leadgen", value: { leadgen_id: leadgenId, page_id: pageId, form_id: "9001", ad_id: "7001", created_time: 1794350000 } }] }] })
const graphLead = (over: Record<string, unknown> = {}) => ({
  created_time: "2026-11-10T20:00:00+0000", ad_id: "7001", ad_name: "Omra 2027 — vidéo", adset_id: "6001", campaign_id: "5001", form_id: "9001", platform: "fb",
  field_data: [{ name: "full_name", values: ["Amine Gharbi"] }, { name: "phone_number", values: ["p:+21622123456"] }, { name: "email", values: ["Amine@Example.com"] }, { name: "ville", values: ["Sfax"] }],
  ...over,
})

interface World { leads: Record<string, unknown>[]; graphCalls: string[]; pages: Record<string, unknown>[] }
let w: World
let graph: (leadgenId: string) => Response

function install(pages: Record<string, unknown>[]) {
  w = { leads: [], graphCalls: [], pages }
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url)
    const dec = decodeURIComponent(u)
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (u.startsWith("https://graph.facebook.com/")) {
      const id = u.match(/graph\.facebook\.com\/v[\d.]+\/(\d+)/)?.[1] ?? ""
      w.graphCalls.push(id)
      expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /)
      expect(u).not.toContain("access_token")
      return graph(id)
    }
    if (dec.includes("/rest/v1/organizations?")) return json(dec.includes("slug=eq.easy2book") ? [{ id: E2B }] : [{ id: E2B }, { id: BOB }])
    if (dec.includes("/rest/v1/landing_meta_pages?")) {
      const pid = dec.match(/page_id=eq\.(\d+)/)?.[1]
      return json(w.pages.filter((p) => p.page_id === pid))
    }
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body))
      if (table === "landing_leads") {
        const dup = w.leads.some((l) => l.organization_id === body.organization_id && (l.idempotency_key === body.idempotency_key || (l.phone === body.phone && l.product === body.product)))
        if (dup) return json({ code: "23505" }, 409)
        w.leads.push(body)
        return json([{ id: "lead-" + w.leads.length }], 201)
      }
      return json([], 201)
    }
    if (table === "landing_leads") return json(w.leads.map((l) => ({ ref: l.ref, id: "x" })))
    return json([])
  }))
}

const page = (id: string, org: string, over: Record<string, unknown> = {}) => ({ page_id: id, organization_id: org, enabled: true, consent_confirmed: true, token_ciphertext: seal("PAGE-TOKEN-" + id), ...over })

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  vi.stubEnv("META_APP_SECRET", APP_SECRET)
  vi.stubEnv("META_LEADS_VERIFY_TOKEN", "jeton-de-verification")
  resetTenantModeCache(); resetPublicOrgCache()
  graph = (id) => new Response(JSON.stringify(graphLead()), { status: 200 })
  install([page(PAGE_E2B, E2B), page(PAGE_BOB, BOB)])
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("analyse de la charge", () => {
  it("extrait uniquement les événements leadgen valides", () => {
    const evs = parseLeadgenPayload(JSON.parse(payload("123456789012345")))
    expect(evs).toEqual([{ leadgenId: "123456789012345", pageId: PAGE_E2B, formId: "9001", adId: "7001", adgroupId: undefined, createdTime: 1794350000 }])
    expect(parseLeadgenPayload({ object: "instagram", entry: [] })).toEqual([])
    expect(parseLeadgenPayload({ object: "page", entry: [{ id: PAGE_E2B, changes: [{ field: "feed", value: {} }] }] })).toEqual([])
    expect(parseLeadgenPayload({ object: "page", entry: [{ id: PAGE_E2B, changes: [{ field: "leadgen", value: { leadgen_id: "abc" } }] }] })).toEqual([])
    expect(parseLeadgenPayload(null)).toEqual([])
  })
  it("convertit les champs du formulaire : nom, téléphone (préfixe p: retiré), e-mail, autres réponses dans le message", () => {
    expect(mapFieldData(graphLead().field_data)).toEqual({ name: "Amine Gharbi", phone: "+21622123456", email: "Amine@Example.com", message: "ville : Sfax" })
    expect(mapFieldData([{ name: "first_name", values: ["Amel"] }, { name: "last_name", values: ["Ben Ali"] }, { name: "phone_number", values: ["98140514"] }])).toMatchObject({ name: "Amel Ben Ali", phone: "98140514" })
    expect(mapFieldData(undefined)).toEqual({ name: "", phone: "" })
  })
})

describe("abonnement (GET) et inertie", () => {
  it("renvoie le challenge avec le bon jeton ; refuse un mauvais jeton", () => {
    const q = (t: string) => new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": t, "hub.challenge": "42424242" })
    expect(handleMetaLeadsGet(q("jeton-de-verification"))).toMatchObject({ status: 200, body: "42424242" })
    expect(handleMetaLeadsGet(q("mauvais")).status).toBe(403)
  })
  it("inerte (404) tant que les secrets ne sont pas définis", async () => {
    vi.stubEnv("META_LEADS_VERIFY_TOKEN", "")
    vi.stubEnv("META_APP_SECRET", "")
    expect(handleMetaLeadsGet(new URLSearchParams({ "hub.mode": "subscribe" })).status).toBe(404)
    const body = payload("200000000000001")
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(404)
    expect(w.leads).toHaveLength(0)
  })
})

describe("réception d'un lead (plateforme simulée)", () => {
  it("signature invalide, absente, ou corps modifié : refusé, rien n'est lu ni enregistré", async () => {
    const body = payload("200000000000002")
    expect((await handleMetaLeadsPost(body, "sha256=" + "0".repeat(64))).status).toBe(401)
    expect((await handleMetaLeadsPost(body, null)).status).toBe(401)
    expect((await handleMetaLeadsPost(body + " ", sign(body))).status).toBe(401)
    expect(w.graphCalls).toHaveLength(0)
    expect(w.leads).toHaveLength(0)
  })

  it("corps trop gros ou JSON invalide : 413 / 400", async () => {
    const big = "x".repeat(300_000)
    expect((await handleMetaLeadsPost(big, sign(big))).status).toBe(413)
    expect((await handleMetaLeadsPost("pas du json", sign("pas du json"))).status).toBe(400)
  })

  it("lead valide : lu avec le jeton de SA page, enregistré dans l'entreprise de la page avec sa source", async () => {
    const body = payload("200000000000003", PAGE_BOB)
    const r = await handleMetaLeadsPost(body, sign(body))
    expect(r.status).toBe(200)
    expect(w.leads).toHaveLength(1)
    expect(w.leads[0]).toMatchObject({
      organization_id: BOB, idempotency_key: "facebook:200000000000003", first_name: "Amine", last_name: "Gharbi", phone: "21622123456", email: "amine@example.com",
      channel: "meta", utm_source: "facebook", campaign_id: "5001", adset_id: "6001", ad_id: "7001", offer: "Omra 2027 — vidéo", message: "ville : Sfax", contact_consent: true, tracking_consent: false,
    })
    expect(w.graphCalls).toEqual(["200000000000003"])
  })

  it("Instagram : la plateforme du lead (ig) donne le canal Instagram", async () => {
    graph = () => new Response(JSON.stringify(graphLead({ platform: "ig" })), { status: 200 })
    const body = payload("200000000000004")
    await handleMetaLeadsPost(body, sign(body))
    expect(w.leads[0]).toMatchObject({ idempotency_key: "instagram:200000000000004", utm_source: "instagram", channel: "meta" })
  })

  it("même événement reçu deux fois (reprise de Meta) : un seul prospect", async () => {
    const body = payload("200000000000005")
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect(w.leads).toHaveLength(1)
  })

  it("page inconnue ou désactivée : ignorée sans erreur, rien n'est lu chez Meta", async () => {
    const unknown = payload("200000000000006", "100000000000099")
    expect((await handleMetaLeadsPost(unknown, sign(unknown))).status).toBe(200)
    install([page(PAGE_E2B, E2B, { enabled: false })])
    const off = payload("200000000000007")
    expect((await handleMetaLeadsPost(off, sign(off))).status).toBe(200)
    expect(w.graphCalls).toHaveLength(0)
    expect(w.leads).toHaveLength(0)
  })

  it("consentement de recontact NON confirmé pour la page : aucun lead enregistré", async () => {
    install([page(PAGE_E2B, E2B, { consent_confirmed: false })])
    const body = payload("200000000000008")
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect(w.leads).toHaveLength(0)
    expect(w.graphCalls).toHaveLength(0)
  })

  it("erreur TEMPORAIRE de Meta (5xx, limite de débit, code 4/17/613, réseau) : 500 pour que Meta rejoue", async () => {
    const body = payload("200000000000009")
    graph = () => new Response("{}", { status: 503 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(500)
    graph = () => new Response(JSON.stringify({ error: { code: 4 } }), { status: 400 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(500)
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      if (String(url).startsWith("https://graph.facebook.com/")) throw new Error("réseau")
      const dec = decodeURIComponent(String(url))
      if (dec.includes("/rest/v1/organizations?")) return new Response(JSON.stringify([{ id: E2B }]), { status: 200 })
      return new Response(JSON.stringify([page(PAGE_E2B, E2B)]), { status: 200 })
    }))
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(500)
  })

  it("après une erreur temporaire, la reprise réussit et ne crée qu'UN prospect", async () => {
    const body = payload("200000000000010")
    graph = () => new Response("{}", { status: 503 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(500)
    graph = () => new Response(JSON.stringify(graphLead()), { status: 200 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect(w.leads).toHaveLength(1)
  })

  it("erreur PERMANENTE (jeton invalide 190, lead supprimé) : 200, pas de reprise inutile, rien d'enregistré", async () => {
    const body = payload("200000000000011")
    graph = () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    graph = () => new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 })
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect(w.leads).toHaveLength(0)
  })

  it("données du formulaire invalides (téléphone absent) : refusées, pas de reprise", async () => {
    graph = () => new Response(JSON.stringify(graphLead({ field_data: [{ name: "full_name", values: ["Sami Ben Ali"] }] })), { status: 200 })
    const body = payload("200000000000012")
    expect((await handleMetaLeadsPost(body, sign(body))).status).toBe(200)
    expect(w.leads).toHaveLength(0)
  })

  it("isolation : deux pages de deux entreprises, chaque lead va dans SON entreprise, avec SON jeton", async () => {
    const a = payload("200000000000013", PAGE_E2B)
    const b = payload("200000000000014", PAGE_BOB)
    graph = () => new Response(JSON.stringify(graphLead({ field_data: [{ name: "full_name", values: ["Client Un"] }, { name: "phone_number", values: ["22111111"] }] })), { status: 200 })
    await handleMetaLeadsPost(a, sign(a))
    graph = () => new Response(JSON.stringify(graphLead({ field_data: [{ name: "full_name", values: ["Client Deux"] }, { name: "phone_number", values: ["22222222"] }] })), { status: 200 })
    await handleMetaLeadsPost(b, sign(b))
    expect(w.leads.map((l) => [l.first_name, l.organization_id])).toEqual([["Client", E2B], ["Client", BOB]])
  })
})
