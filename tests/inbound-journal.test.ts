import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("@/lib/server/notify", () => ({ notifyNewLead: vi.fn(async () => undefined) }))

import { loadInboundJournal, recordInboundEvent } from "@/lib/server/inbound-events"
import { ingestExternalLead } from "@/lib/server/inbound-leads"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"

let calls: { method: string; url: string; body?: Record<string, unknown> }[]
let handler: (url: string, method: string, body?: Record<string, unknown>) => Response | undefined

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  resetTenantModeCache(); resetPublicOrgCache()
  calls = []
  handler = () => undefined
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = decodeURIComponent(String(url))
    const method = (init.method || "GET").toUpperCase()
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    if (u.includes("/rest/v1/organizations?")) return new Response(JSON.stringify([{ id: E2B }, { id: BOB }]), { status: 200 })
    calls.push({ method, url: u, body })
    return handler(u, method, body) ?? new Response(JSON.stringify([]), { status: method === "POST" ? 201 : 200 })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("recordInboundEvent", () => {
  it("écrit une ligne dans l'entreprise donnée, avec des valeurs nettoyées", async () => {
    await recordInboundEvent(BOB, { platform: "facebook", externalId: "123 456<script>", sourceRef: "1000 0001", status: "created", reason: "cree" })
    const post = calls.find((c) => c.method === "POST")!
    expect(post.url).toContain("/landing_inbound_events")
    expect(post.body).toMatchObject({ organization_id: BOB, platform: "facebook", external_id: "123456script", source_ref: "10000001", status: "created", reason: "cree" })
  })
  it("ne lève jamais d'erreur : table absente, base en panne, entreprise ou identifiant invalides", async () => {
    handler = () => new Response(JSON.stringify({ code: "42P01" }), { status: 404 })
    await expect(recordInboundEvent(E2B, { platform: "whatsapp", externalId: "wamid.1", status: "ignored" })).resolves.toBeUndefined()
    handler = () => new Response("{}", { status: 500 })
    await expect(recordInboundEvent(E2B, { platform: "whatsapp", externalId: "wamid.1", status: "ignored" })).resolves.toBeUndefined()
    calls = []
    await recordInboundEvent("pas-une-entreprise", { platform: "whatsapp", externalId: "wamid.1", status: "ignored" })
    await recordInboundEvent(E2B, { platform: "whatsapp", externalId: "<>", status: "ignored" })
    expect(calls).toHaveLength(0)
  })
})

describe("loadInboundJournal", () => {
  it("lit uniquement l'entreprise demandée et calcule la santé par canal sur 7 jours", async () => {
    const rows = [
      { id: 3, platform: "facebook", external_id: "3", source_ref: "p", status: "dropped", reason: "graph_190", created_at: "2026-11-14T10:00:00Z" },
      { id: 2, platform: "facebook", external_id: "2", source_ref: "p", status: "created", reason: "cree", created_at: "2026-11-13T10:00:00Z" },
      { id: 1, platform: "whatsapp", external_id: "1", source_ref: "n", status: "duplicate", reason: null, created_at: "2026-11-12T10:00:00Z" },
    ]
    handler = (u) => (u.includes("landing_inbound_events") ? new Response(JSON.stringify(rows), { status: 200 }) : undefined)
    const j = await loadInboundJournal(BOB)
    expect(calls.filter((c) => c.url.includes("landing_inbound_events")).every((c) => c.url.includes(`organization_id=eq.${BOB}`))).toBe(true)
    expect(j.tableMissing).toBe(false)
    expect(j.events).toHaveLength(3)
    const fb = j.health.find((h) => h.platform === "facebook")!
    expect(fb).toMatchObject({ created: 1, dropped: 1, lastAt: "2026-11-14T10:00:00Z" })
    expect(j.health.find((h) => h.platform === "whatsapp")).toMatchObject({ duplicate: 1 })
    expect(j.health.find((h) => h.platform === "tiktok")).toMatchObject({ lastAt: null, created: 0 })
  })
  it("migration 0023 absente : indique « table absente » sans erreur", async () => {
    handler = () => new Response(JSON.stringify({ code: "42P01" }), { status: 404 })
    const j = await loadInboundJournal(E2B)
    expect(j).toMatchObject({ tableMissing: true, events: [] })
  })
  it("panne de la base : liste vide, pas d'exception, pas de faux « table absente »", async () => {
    handler = () => new Response("{}", { status: 500 })
    expect(await loadInboundJournal(E2B)).toMatchObject({ tableMissing: false, events: [] })
  })
})

describe("deuxième source le même jour (écart G5)", () => {
  const input = { platform: "facebook" as const, externalId: "400000000000002", name: "Amine Gharbi", phone: "22123456", contactConsent: true, campaignId: "5002", offer: "Hôtel Djerba" }
  it("autre événement, même téléphone, même jour : le lead existant est conservé et la nouvelle source est tracée dans son historique", async () => {
    handler = (u, m) => {
      if (u.includes("landing_leads") && m === "POST") return new Response(JSON.stringify({ code: "23505" }), { status: 409 })
      if (u.includes("landing_leads") && m === "GET") return new Response(JSON.stringify([{ ref: "E2B-AAAAAA", id: "lead-1", idempotency_key: "facebook:400000000000001" }]), { status: 200 })
      return undefined
    }
    const r = await ingestExternalLead(E2B, input)
    expect(r).toEqual({ ok: true, ref: "E2B-AAAAAA", leadId: "lead-1", duplicate: true })
    const note = calls.find((c) => c.url.includes("landing_lead_activities") && c.method === "POST")!
    expect(note.body).toMatchObject({ lead_id: "lead-1", type: "note" })
    expect(String(note.body!.body)).toContain("Nouvelle demande reçue via Facebook")
    expect(String(note.body!.body)).toContain("5002")
    expect(String(note.body!.body)).toContain("400000000000002")
  })
  it("même événement rejoué : aucune note ajoutée", async () => {
    handler = (u, m) => {
      if (u.includes("landing_leads") && m === "POST") return new Response(JSON.stringify({ code: "23505" }), { status: 409 })
      if (u.includes("landing_leads") && m === "GET") return new Response(JSON.stringify([{ ref: "E2B-AAAAAA", id: "lead-1", idempotency_key: "facebook:400000000000002" }]), { status: 200 })
      return undefined
    }
    const r = await ingestExternalLead(E2B, input)
    expect(r).toMatchObject({ ok: true, duplicate: true })
    expect(calls.some((c) => c.url.includes("landing_lead_activities"))).toBe(false)
  })
})
