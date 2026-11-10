import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { listMetaPages, saveMetaPage } from "@/lib/server/meta-pages"
import { open } from "@/lib/server/secret-box"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
const TOKEN = "EAA" + "x".repeat(60)
let rows: Record<string, unknown>[]
let absent = false

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  resetTenantModeCache(); resetPublicOrgCache()
  rows = []; absent = false
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json(dec.includes("slug=eq.easy2book") ? [{ id: E2B }] : [{ id: E2B }, { id: BOB }])
    if (!dec.includes("/rest/v1/landing_meta_pages")) return json([])
    if (absent) return json({ code: "42P01" }, 404)
    const pid = dec.match(/page_id=eq\.(\d+)/)?.[1]
    const org = dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
    if (init.method === "POST") {
      const b = JSON.parse(String(init.body))
      if (rows.some((r) => r.page_id === b.page_id)) return json({ code: "23505" }, 409)
      rows.push(b)
      return json([b], 201)
    }
    if (init.method === "PATCH") {
      const b = JSON.parse(String(init.body))
      rows.filter((r) => r.page_id === pid && (!org || r.organization_id === org)).forEach((r) => Object.assign(r, b))
      return json([], 200)
    }
    return json(rows.filter((r) => (!pid || r.page_id === pid) && (!org || r.organization_id === org)))
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const input = { pageId: "100000000000001", pageName: "Easy2Book", token: TOKEN, enabled: true, consentConfirmed: true }

describe("pages Facebook d'une entreprise", () => {
  it("création : jeton chiffré (jamais en clair), quatre derniers caractères seuls exposés", async () => {
    expect(await saveMetaPage(E2B, "u1", input)).toEqual({ ok: true })
    const row = rows[0]
    expect(row.organization_id).toBe(E2B)
    expect(row.token_ciphertext).toMatch(/^v1:/)
    expect(JSON.stringify(rows)).not.toContain(TOKEN)
    expect(open(String(row.token_ciphertext))).toBe(TOKEN)
    const list = await listMetaPages(E2B)
    expect(list.pages).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain("token_ciphertext")
    expect(list.pages[0].token_last4).toBe("xxxx")
  })

  it("validation : identifiant, jeton, activation sans confirmation de l'accord de recontact", async () => {
    expect(await saveMetaPage(E2B, null, { ...input, pageId: "abc" })).toMatchObject({ ok: false, errors: { pageId: expect.any(String) } })
    expect(await saveMetaPage(E2B, null, { ...input, token: "mot-de-passe" })).toMatchObject({ ok: false, errors: { token: expect.any(String) } })
    expect(await saveMetaPage(E2B, null, { ...input, consentConfirmed: false })).toMatchObject({ ok: false, errors: { consentConfirmed: expect.any(String) } })
    expect(await saveMetaPage(E2B, null, { ...input, token: "" })).toMatchObject({ ok: false, errors: { token: expect.any(String) } })
    expect(rows).toHaveLength(0)
  })

  it("une page appartient à UNE entreprise : une autre ne peut pas la prendre ni la modifier", async () => {
    await saveMetaPage(E2B, null, input)
    const r = await saveMetaPage(BOB, null, { ...input, pageName: "Volée" })
    expect(r).toMatchObject({ ok: false, errors: { pageId: expect.stringMatching(/autre entreprise/) } })
    expect(rows).toHaveLength(1)
    expect(rows[0].page_name).toBe("Easy2Book")
    expect((await listMetaPages(BOB)).pages).toHaveLength(0)
  })

  it("mise à jour : le jeton enregistré est gardé si le champ est vide ; remplacé sinon", async () => {
    await saveMetaPage(E2B, null, input)
    const before = String(rows[0].token_ciphertext)
    await saveMetaPage(E2B, null, { ...input, token: "", pageName: "Nouveau nom", enabled: false, consentConfirmed: false })
    expect(rows[0]).toMatchObject({ page_name: "Nouveau nom", enabled: false, consent_confirmed: false })
    expect(rows[0].token_ciphertext).toBe(before)
    const NEW = "EAA" + "y".repeat(60)
    await saveMetaPage(E2B, null, { ...input, token: NEW })
    expect(open(String(rows[0].token_ciphertext))).toBe(NEW)
  })

  it("migration 0015 non appliquée : message clair, liste vide en lecture seule", async () => {
    absent = true
    expect(await saveMetaPage(E2B, null, input)).toMatchObject({ ok: false, message: expect.stringMatching(/0015/) })
    expect(await listMetaPages(E2B)).toEqual({ pages: [], migrationApplied: false })
  })
})
