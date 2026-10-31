import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/leads/route"
import { __resetGuards } from "@/lib/server/guard"
import { configureAll, installFetchMock, post } from "./helpers"

const base = {
  eventId: "lead-evt-0001",
  name: "Ahmed Ben Ali",
  phone: "98 140 514",
  product: "voyage",
  offer: "Istanbul Été 2026",
  adults: 2,
  children: 1,
  contactConsent: true,
  marketingConsent: false,
  trackingConsent: true,
  attribution: {
    visitor_id: "visitor-1",
    ref: "E2B-ABC234",
    last_touch: { channel: "meta", utm_source: "facebook", utm_campaign: "voyages_ete", landing_page: "/voyages-organises" },
  },
}

beforeEach(() => {
  __resetGuards()
  configureAll()
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/leads", () => {
  it("transmet le lead au CRM EasyV4 selon le contrat submitLead", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", base))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toMatchObject({ ok: true, ref: "E2B-ABC234", forwarded: true })
    expect(json.whatsappUrl).toContain(encodeURIComponent("Réf: E2B-ABC234"))

    const [crm] = f.crm()
    expect((crm.init.headers as Record<string, string>).Authorization).toBe("Bearer crm-secret")
    expect((crm.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("lead-evt-0001")
    expect(crm.body).toEqual({
      firstName: "Ahmed",
      lastName: "Ben Ali",
      phone: "+21698140514",
      message: expect.stringContaining("Réf landing : E2B-ABC234"),
      productType: "package",
      productLabel: "Istanbul Été 2026",
      sourcePage: "landing-easy2book/voyages-organises",
      intention: "standard",
      campaignRef: "voyages_ete",
      marketingConsent: false,
    })
  })

  it("utilise le même event_id que le navigateur pour Meta et TikTok (déduplication)", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    expect(f.meta()[0].body.data[0]).toMatchObject({ event_name: "Lead", event_id: "lead-evt-0001" })
    expect(f.tiktok()[0].body.data[0]).toMatchObject({ event: "SubmitForm", event_id: "lead-evt-0001" })
  })

  it("n'envoie RIEN à Meta ni à TikTok sans consentement aux traceurs", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, trackingConsent: false }))
    expect(res.status).toBe(200)
    expect(f.crm()).toHaveLength(1)
    expect(f.meta()).toHaveLength(0)
    expect(f.tiktok()).toHaveLength(0)
  })

  it("transmet le consentement marketing tel que coché (jamais implicite)", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", { ...base, marketingConsent: true }))
    expect(f.crm()[0].body.marketingConsent).toBe(true)
    __resetGuards()
    const g = installFetchMock()
    await POST(post("/api/leads", { ...base, eventId: "lead-evt-0002", marketingConsent: "yes" }))
    expect(g.crm()[0].body.marketingConsent).toBe(false)
  })

  it("refuse un téléphone invalide ou l'absence d'accord de recontact", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, phone: "123", contactConsent: false }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(Object.keys(json.errors).sort()).toEqual(["contactConsent", "phone"])
    expect(f.calls).toHaveLength(0)
  })

  it("ignore silencieusement les robots (champ piège)", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, website: "http://spam" }))
    expect(res.status).toBe(200)
    expect(f.calls).toHaveLength(0)
  })

  it("bloque les doublons : même event_id, puis même téléphone + produit", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    const second = await (await POST(post("/api/leads", base))).json()
    const third = await (await POST(post("/api/leads", { ...base, eventId: "lead-evt-0003", phone: "+21698140514" }))).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, ref: "E2B-ABC234" })
    expect(third).toMatchObject({ ok: true, duplicate: true })
    expect(f.crm()).toHaveLength(1)
    expect(f.meta()).toHaveLength(1)
  })

  it("accepte le même téléphone pour un autre produit", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    await POST(post("/api/leads", { ...base, eventId: "lead-evt-0004", product: "omra" }))
    expect(f.crm().map((c) => c.body.productType)).toEqual(["package", "omra"])
  })

  it("refuse une origine étrangère", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", base, { origin: "https://evil.example" }))
    expect(res.status).toBe(403)
    expect(f.calls).toHaveLength(0)
  })

  it("limite le débit par IP (5 envois / 10 min)", async () => {
    installFetchMock()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await POST(
        post("/api/leads", { ...base, eventId: `rate-evt-000${i}`, phone: `2212345${i}` }, { "x-forwarded-for": "9.9.9.9" })
      )
      statuses.push(res.status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it("répond quand même (WhatsApp) si le CRM n'est pas configuré ou refuse", async () => {
    vi.stubEnv("EASYV4_LEAD_INTAKE_URL", "")
    let f = installFetchMock()
    let json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, forwarded: false })
    expect(f.crm()).toHaveLength(0)

    __resetGuards()
    configureAll()
    f = installFetchMock({ crmStatus: 500 })
    json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, forwarded: false })
    expect(json.whatsappUrl).toMatch(/^https:\/\/wa\.me\/21698140514\?text=/)
  })

  it("marque un groupe de 10 voyageurs ou plus en intention « groupe »", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", { ...base, product: "omra", adults: 8, children: 2 }))
    expect(f.crm()[0].body).toMatchObject({ productType: "omra", intention: "groupe" })
  })

  it("rejette un event_id malformé en le remplaçant", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", { ...base, eventId: "<bad id>" }))
    expect(f.meta()[0].body.data[0].event_id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
