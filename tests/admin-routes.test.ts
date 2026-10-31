import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST as leadPOST } from "@/app/api/leads/route"
import { POST as statusPOST } from "@/app/api/leads/status/route"
import { GET as exportGET } from "@/app/api/leads/export/route"
import { __resetGuards } from "@/lib/server/guard"
import { ADMIN_KEY, configureAll, installFetchMock, post, request } from "./helpers"

const lead = (overrides: Record<string, unknown> = {}) => ({
  eventId: "admin-evt-0001",
  name: "Sana Trabelsi",
  phone: "55123456",
  product: "omra",
  contactConsent: true,
  trackingConsent: true,
  attribution: { ref: "E2B-QWE234", visitor_id: "v9", last_touch: { channel: "tiktok", ttclid: "TT9" } },
  ...overrides,
})
const admin = { "x-api-key": ADMIN_KEY }

beforeEach(() => {
  __resetGuards()
  configureAll()
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/leads/status", () => {
  it("refuse sans clé, avec une mauvaise clé, ou si la clé configurée est trop courte", async () => {
    installFetchMock()
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "contacte" }))).status).toBe(401)
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "contacte" }, { "x-api-key": "x".repeat(40) }))).status).toBe(401)
    vi.stubEnv("LANDING_ADMIN_API_KEY", "court")
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "contacte" }, { "x-api-key": "court" }))).status).toBe(401)
  })

  it("valide le statut, la référence et le montant", async () => {
    installFetchMock()
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "gagne" }, admin))).status).toBe(400)
    expect((await statusPOST(post("/api/leads/status", { ref: "abc", status: "contacte" }, admin))).status).toBe(400)
    expect((await statusPOST(post("/api/leads/status", { id: "1 or 1=1", status: "contacte" }, admin))).status).toBe(400)
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "reserve" }, admin))).status).toBe(400)
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "reserve", booking_value: -1 }, admin))).status).toBe(400)
  })

  it("réservation : met à jour le lead et envoie Purchase / CompletePayment (event_id stable)", async () => {
    const f = installFetchMock()
    await leadPOST(post("/api/leads", lead()))
    const res = await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "reserve", booking_value: 4800 }, admin))
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, conversion: "envoyée", lead: { ref: "E2B-QWE234", status: "reserve" } })
    const row = f.db.landing_leads[0]
    expect(row).toMatchObject({ status: "reserve", booking_value: 4800 })
    expect(row.booked_at).toBeTruthy()
    const purchase = f.meta().find((c) => c.body.data[0].event_name === "Purchase")!.body.data[0]
    expect(purchase).toMatchObject({ event_id: `purchase-${row.id}`, action_source: "chat", custom_data: { value: 4800, currency: "TND" } })
    expect(f.tiktok().find((c) => c.body.data[0].event === "CompletePayment")!.body.data[0].event_id).toBe(`purchase-${row.id}`)
  })

  it("réservation d'un prospect sans consentement traceurs : aucune conversion envoyée", async () => {
    const f = installFetchMock()
    await leadPOST(post("/api/leads", lead({ trackingConsent: false })))
    const json = await (await statusPOST(post("/api/leads/status", { ref: "E2B-QWE234", status: "reserve", booking_value: 4800 }, admin))).json()
    expect(json.conversion).toBe("sans consentement")
    expect(f.meta()).toHaveLength(0)
    expect(f.tiktok()).toHaveLength(0)
  })

  it("lead inconnu : 404", async () => {
    installFetchMock()
    expect((await statusPOST(post("/api/leads/status", { ref: "E2B-NOP234", status: "contacte" }, admin))).status).toBe(404)
  })
})

describe("GET /api/leads/export", () => {
  it("refuse sans clé, et n'accepte pas la clé dans l'URL", async () => {
    installFetchMock()
    expect((await exportGET(request("GET", "/api/leads/export"))).status).toBe(401)
    expect((await exportGET(request("GET", `/api/leads/export?key=${ADMIN_KEY}`))).status).toBe(401)
  })

  it("rejette les filtres invalides (pas d'injection dans la requête Supabase)", async () => {
    const f = installFetchMock()
    expect((await exportGET(request("GET", "/api/leads/export?status=reserve,phone.neq.0", undefined, admin))).status).toBe(400)
    expect((await exportGET(request("GET", "/api/leads/export?since=2026-01-01&select=*", undefined, admin))).status).toBe(200)
    const q = decodeURIComponent(f.dbCalls().at(-1)!.url)
    expect(q).not.toContain("select=*")
    expect(q).not.toContain("ip")
  })

  it("exporte en CSV avec neutralisation des formules", async () => {
    installFetchMock()
    await leadPOST(post("/api/leads", lead({ name: "=HYPERLINK(evil) X" })))
    const res = await exportGET(request("GET", "/api/leads/export?format=csv", undefined, admin))
    expect(res.headers.get("content-type")).toContain("text/csv")
    const csv = await res.text()
    expect(csv.split("\n")[0]).toContain("created_at,ref,status,first_name")
    expect(csv).toContain("'=HYPERLINK(evil)")
  })
})
