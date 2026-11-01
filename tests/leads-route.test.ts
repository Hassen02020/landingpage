import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/leads/route"
import { __resetGuards } from "@/lib/server/guard"
import { DB_URL, configureAll, installFetchMock, post } from "./helpers"

const base = {
  eventId: "lead-evt-0001",
  name: "Ahmed Ben Ali",
  phone: "98 140 514",
  product: "voyage",
  offer: "Istanbul Été 2026",
  niche: "Turquie",
  adults: 2,
  children: 1,
  contactConsent: true,
  marketingConsent: false,
  trackingConsent: true,
  attribution: {
    visitor_id: "visitor-1",
    ref: "E2B-ABC234",
    fbp: "fb.1.1.123",
    last_touch: { channel: "meta", utm_source: "facebook", utm_campaign: "voyages_ete", ad_id: "AD1", fbclid: "FB1", landing_page: "/voyages-organises" },
  },
}

beforeEach(() => {
  __resetGuards()
  configureAll()
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/leads", () => {
  it("enregistre le lead dans la base dédiée des landing pages", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", base))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toMatchObject({ ok: true, stored: true })
    expect(json.ref).toMatch(/^E2B-[2-9A-HJ-NP-Z]{6}$/)
    expect(json.ref).not.toBe("E2B-ABC234") // la référence du lead est générée par le serveur
    expect(json.whatsappUrl).toContain(encodeURIComponent(`Réf: ${json.ref}`))

    const insert = f.dbCalls().find((c) => c.method === "POST" && c.url === `${DB_URL}/rest/v1/landing_leads`)!
    expect(insert.url).toBe(`${DB_URL}/rest/v1/landing_leads`)
    expect((insert.init.headers as Record<string, string>).Authorization).toBe("Bearer service-role-test")
    expect(insert.body).toMatchObject({
      ref: json.ref,
      visitor_ref: "E2B-ABC234",
      idempotency_key: "lead-evt-0001",
      first_name: "Ahmed",
      last_name: "Ben Ali",
      phone: "21698140514",
      product: "voyage",
      offer: "Istanbul Été 2026",
      niche: "Turquie",
      contact_consent: true,
      marketing_consent: false,
      tracking_consent: true,
      channel: "meta",
      utm_campaign: "voyages_ete",
      ad_id: "AD1",
      visitor_id: "visitor-1",
      fbclid: "FB1",
      fbp: "fb.1.1.123",
    })
  })

  it("utilise le même event_id que le navigateur pour Meta et TikTok (déduplication)", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    expect(f.meta()[0].body.data[0]).toMatchObject({ event_name: "Lead", event_id: "lead-evt-0001" })
    expect(f.tiktok()[0].body.data[0]).toMatchObject({ event: "SubmitForm", event_id: "lead-evt-0001" })
  })

  it("sans consentement traceurs : rien chez Meta/TikTok et aucun identifiant publicitaire stocké", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, trackingConsent: false }))
    expect(res.status).toBe(200)
    expect(f.meta()).toHaveLength(0)
    expect(f.tiktok()).toHaveLength(0)
    const row = f.dbCalls()[0].body
    expect(row.tracking_consent).toBe(false)
    for (const k of ["visitor_id", "fbclid", "ttclid", "fbp", "fbc", "ttp", "ip", "user_agent"]) expect(row).not.toHaveProperty(k)
    expect(row.utm_campaign).toBe("voyages_ete") // donnée de campagne non personnelle conservée
  })

  it("enregistre le consentement marketing tel que coché (jamais implicite)", async () => {
    let f = installFetchMock()
    await POST(post("/api/leads", { ...base, marketingConsent: true }))
    expect(f.dbCalls()[0].body.marketing_consent).toBe(true)
    __resetGuards()
    f = installFetchMock()
    await POST(post("/api/leads", { ...base, eventId: "lead-evt-0002", marketingConsent: "yes" }))
    expect(f.dbCalls()[0].body.marketing_consent).toBe(false)
  })

  it("refuse un téléphone invalide ou l'absence d'accord de recontact", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, phone: "123", contactConsent: false }))
    expect(res.status).toBe(422)
    expect(Object.keys((await res.json()).errors).sort()).toEqual(["contactConsent", "phone"])
    expect(f.calls).toHaveLength(0)
  })

  it("ignore silencieusement les robots (champ piège)", async () => {
    const f = installFetchMock()
    expect((await POST(post("/api/leads", { ...base, website: "http://spam" }))).status).toBe(200)
    expect(f.calls).toHaveLength(0)
  })

  it("bloque les doublons en mémoire : même event_id, puis même téléphone + produit", async () => {
    const f = installFetchMock()
    const first = await (await POST(post("/api/leads", base))).json()
    const second = await (await POST(post("/api/leads", base))).json()
    const third = await (await POST(post("/api/leads", { ...base, eventId: "lead-evt-0003", phone: "+21698140514" }))).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, ref: first.ref })
    expect(third).toMatchObject({ ok: true, duplicate: true })
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.meta()).toHaveLength(1)
  })

  it("bloque les doublons en base (autre instance serveur) et renvoie la référence existante", async () => {
    const f = installFetchMock()
    const first = await (await POST(post("/api/leads", base))).json()
    __resetGuards() // simule une autre instance : mémoire vide
    const json = await (await POST(post("/api/leads", { ...base, eventId: "lead-evt-0009", attribution: { ref: "E2B-ZZZ999" } }))).json()
    expect(json).toMatchObject({ ok: true, duplicate: true, ref: first.ref })
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.meta()).toHaveLength(1) // pas de second événement Lead
  })

  it("accepte le même téléphone pour un autre produit", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    await POST(post("/api/leads", { ...base, eventId: "lead-evt-0004", product: "omra" }))
    expect(f.db.landing_leads.map((r) => r.product)).toEqual(["voyage", "omra"])
  })

  it("refuse une origine étrangère", async () => {
    const f = installFetchMock()
    expect((await POST(post("/api/leads", base, { origin: "https://evil.example" }))).status).toBe(403)
    expect(f.calls).toHaveLength(0)
  })

  it("limite le débit par IP (5 envois / 10 min)", async () => {
    installFetchMock()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await POST(post("/api/leads", { ...base, eventId: `rate-evt-000${i}`, phone: `2212345${i}` }, { "x-forwarded-for": "9.9.9.9" }))
      statuses.push(res.status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it("répond quand même (WhatsApp) si la base n'est pas configurée ou en erreur", async () => {
    vi.stubEnv("LANDING_SUPABASE_URL", "")
    let f = installFetchMock()
    let json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, stored: false })
    expect(f.dbCalls()).toHaveLength(0)

    __resetGuards()
    configureAll()
    f = installFetchMock({ dbStatus: 500 })
    json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, stored: false })
    expect(json.whatsappUrl).toMatch(/^https:\/\/wa\.me\/21698140514\?text=/)
  })

  it("refuse de se connecter au CRM EasyV4, même mal configuré", async () => {
    vi.stubEnv("LANDING_SUPABASE_URL", "https://crygnaichvlxavvbifqi.supabase.co")
    const f = installFetchMock()
    const json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, stored: false })
    expect(f.calls.some((c) => c.url.includes("crygnaichvlxavvbifqi"))).toBe(false)
  })

  it("une référence visiteur identique ne permet pas de viser le lead d'un autre prospect", async () => {
    const f = installFetchMock()
    const a = await (await POST(post("/api/leads", base))).json()
    const b = await (await POST(post("/api/leads", { ...base, eventId: "lead-evt-0005", phone: "22000111" }))).json()
    expect(a.ref).not.toBe(b.ref)
    expect(f.db.landing_leads.map((r) => r.visitor_ref)).toEqual(["E2B-ABC234", "E2B-ABC234"])
    expect(new Set(f.db.landing_leads.map((r) => r.ref)).size).toBe(2)
  })

  it("rejoue l'insertion avec une nouvelle référence en cas de collision", async () => {
    const f = installFetchMock()
    f.db.landing_leads.push({ ref: "E2B-AAAAAA", idempotency_key: "other-0001", phone: "21600000000", product: "hotel", lead_day: "2000-01-01" })
    const hash = await import("@/lib/server/hash")
    const spy = vi.spyOn(hash, "randomRef").mockReturnValueOnce("E2B-AAAAAA").mockReturnValueOnce("E2B-BBBBBB")
    const json = await (await POST(post("/api/leads", base))).json()
    expect(json).toMatchObject({ ok: true, stored: true, ref: "E2B-BBBBBB" })
    expect(f.db.landing_leads).toHaveLength(2)
    spy.mockRestore()
  })

  it("remplace un event_id malformé", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", { ...base, eventId: "<bad id>" }))
    expect(f.meta()[0].body.data[0].event_id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
