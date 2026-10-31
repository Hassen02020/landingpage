import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { notifyNewLead } from "@/lib/server/notify"
import { hmacSha256 } from "@/lib/server/hash"
import { POST } from "@/app/api/leads/route"
import { __resetGuards } from "@/lib/server/guard"
import { configureAll, installFetchMock, post } from "./helpers"

const notice = { id: "abc", ref: "E2B-ABC234", product: "omra" as const, offer: "Fouj 1", firstName: "Sana", phone: "21655123456", source: "formulaire", channel: "meta", utmCampaign: "omra_ete" }

function mockOut() {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return new Response("{}", { status: 200 })
  }))
  return calls
}

afterEach(() => vi.unstubAllEnvs())

describe("notifyNewLead", () => {
  it("sans configuration : aucun envoi", async () => {
    const calls = mockOut()
    expect(await notifyNewLead(notice)).toEqual({ email: null, webhook: null })
    expect(calls).toHaveLength(0)
  })

  it("e-mail Resend et webhook signé", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("NOTIFY_EMAIL_TO", "equipe@easy2book.tn, chef@easy2book.tn")
    vi.stubEnv("NOTIFY_WEBHOOK_URL", "https://hook.test/lead")
    vi.stubEnv("NOTIFY_WEBHOOK_SECRET", "s3cret")
    const calls = mockOut()
    expect(await notifyNewLead(notice)).toEqual({ email: true, webhook: true })
    const mail = JSON.parse(String(calls[0].init.body))
    expect(calls[0].url).toBe("https://api.resend.com/emails")
    expect(mail.to).toEqual(["equipe@easy2book.tn", "chef@easy2book.tn"])
    expect(mail.text).toContain("E2B-ABC234")
    expect(mail.text).toContain("/admin/leads/abc")
    const hookBody = String(calls[1].init.body)
    expect((calls[1].init.headers as Record<string, string>)["X-E2B-Signature"]).toBe(hmacSha256("s3cret", hookBody))
  })

  it("une panne d'envoi ne lève pas d'erreur", async () => {
    vi.stubEnv("NOTIFY_WEBHOOK_URL", "https://hook.test/lead")
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau") }))
    expect(await notifyNewLead(notice)).toEqual({ email: null, webhook: false })
  })
})

describe("POST /api/leads : historique et notification", () => {
  beforeEach(() => {
    __resetGuards()
    configureAll()
  })

  it("écrit l'activité « créé » avec la version du consentement et prévient l'équipe", async () => {
    vi.stubEnv("NOTIFY_WEBHOOK_URL", "https://hook.test/lead")
    const f = installFetchMock()
    const json = await (await POST(post("/api/leads", { eventId: "lead-evt-0101", name: "Sana Ben", phone: "55123456", product: "omra", contactConsent: true }))).json()
    expect(f.db.landing_leads[0]).toMatchObject({ consent_text_version: "2026-11-v1" })
    expect(f.db.landing_lead_activities[0]).toMatchObject({ type: "created", actor_label: "système", lead_id: f.db.landing_leads[0].id })
    expect(f.calls.some((c) => c.url === "https://hook.test/lead" && String(c.init.body).includes(json.ref))).toBe(true)
  })

  it("base en panne : l'équipe est quand même prévenue (lead non perdu)", async () => {
    vi.stubEnv("NOTIFY_WEBHOOK_URL", "https://hook.test/lead")
    const f = installFetchMock({ dbStatus: 500 })
    await POST(post("/api/leads", { eventId: "lead-evt-0102", name: "Sana Ben", phone: "55123457", product: "omra", contactConsent: true }))
    const hook = f.calls.find((c) => c.url === "https://hook.test/lead")
    expect(String(hook?.init.body)).toContain("NON ENREGISTR")
  })
})
