import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { listWhatsAppNumbers, saveWhatsAppNumber } from "@/lib/server/whatsapp-numbers"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
let rows: { phone_number_id: string; organization_id: string; enabled: boolean; display_phone: string | null; updated_at: string }[]
let mode: "ok" | "missing" | "down"

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  resetTenantModeCache(); resetPublicOrgCache()
  rows = []; mode = "ok"
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (u.includes("/rest/v1/organizations?")) return json([{ id: E2B }, { id: BOB }])
    if (mode === "missing") return json({ code: "42P01" }, 404)
    if (mode === "down") return json({}, 500)
    const method = (init.method || "GET").toUpperCase()
    if (method === "POST") {
      const b = JSON.parse(String(init.body))
      if (rows.some((r) => r.phone_number_id === b.phone_number_id)) return json({ code: "23505" }, 409)
      rows.push({ ...b }); return json([b], 201)
    }
    if (method === "PATCH") {
      const id = u.match(/phone_number_id=eq\.(\d+)/)?.[1]; const org = u.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
      const hit = rows.filter((r) => r.phone_number_id === id && r.organization_id === org)
      hit.forEach((r) => Object.assign(r, JSON.parse(String(init.body)))); return json(hit)
    }
    const id = u.match(/phone_number_id=eq\.(\d+)/)?.[1]
    const org = u.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
    return json(rows.filter((r) => (!id || r.phone_number_id === id) && (!org || r.organization_id === org)))
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("numéros WhatsApp Business", () => {
  it("enregistre, active, puis met à jour un numéro de l'entreprise", async () => {
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "200000000000001", displayPhone: "+216 98 140 514", enabled: false })).toEqual({ ok: true })
    expect(rows[0]).toMatchObject({ phone_number_id: "200000000000001", organization_id: E2B, enabled: false })
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "200000000000001", displayPhone: "", enabled: true })).toEqual({ ok: true })
    expect(rows[0].enabled).toBe(true)
    expect((await listWhatsAppNumbers(E2B)).numbers).toEqual([expect.objectContaining({ phone_number_id: "200000000000001", enabled: true })])
  })
  it("identifiant invalide refusé ; un numéro d'une autre entreprise ne peut pas être pris ni listé", async () => {
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "1234", displayPhone: "", enabled: true })).toMatchObject({ ok: false, errors: { phoneNumberId: expect.stringContaining("5 à 25 chiffres") } })
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "abc", displayPhone: "", enabled: true })).toMatchObject({ ok: false })
    await saveWhatsAppNumber(E2B, null, { phoneNumberId: "200000000000001", displayPhone: "", enabled: true })
    expect(await saveWhatsAppNumber(BOB, null, { phoneNumberId: "200000000000001", displayPhone: "", enabled: true })).toMatchObject({ ok: false, errors: { phoneNumberId: expect.stringContaining("autre entreprise") } })
    expect(rows).toHaveLength(1)
    expect((await listWhatsAppNumbers(BOB)).numbers).toEqual([])
  })
  it("migration 0024 absente : message clair, jamais d'exception", async () => {
    mode = "missing"
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "200000000000001", displayPhone: "", enabled: true })).toMatchObject({ ok: false, message: expect.stringContaining("0024") })
    expect(await listWhatsAppNumbers(E2B)).toEqual({ numbers: [], migrationApplied: false })
    mode = "down"
    expect(await saveWhatsAppNumber(E2B, null, { phoneNumberId: "200000000000001", displayPhone: "", enabled: true })).toMatchObject({ ok: false })
  })
})
