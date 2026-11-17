// Journal et relance des conversions Meta (migration 0028). Jeux de données FICTIFS, aucun appel réseau réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { GET as cronGET } from "@/app/api/cron/retry-conversions/route"
import { MAX_ATTEMPTS, META_MAX_AGE_S, RETRY_DELAYS_MIN, buildConversionEvent, conversionStats, outcomePatch, retryConversions, safeError, sendMetaLogged } from "@/lib/server/conversions"
import { changeStatus, type LeadRow } from "@/lib/server/crm"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

type Row = Record<string, any>
const DB = "https://landing-db.test"
let log: Row[], leads: Row[], metaOutcome: () => Response, metaBodies: any[], logUnavailable: boolean, seq: number

function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url), method = (init.method || "GET").toUpperCase()
    if (u.includes("graph.facebook.com")) { metaBodies.push(JSON.parse(String(init.body))); return metaOutcome() }
    const dec = decodeURIComponent(u)
    if (dec.includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (table === "landing_conversion_log") {
      if (logUnavailable) return new Response(JSON.stringify({ code: "42P01" }), { status: 404 })
      if (method === "POST") {
        if (log.some((r) => r.event_id === body.event_id && r.network === body.network)) return new Response(JSON.stringify({ code: "23505" }), { status: 409 })
        log.push({ id: ++seq, created_at: new Date().toISOString(), sent_at: null, next_retry_at: null, last_error: null, ...body })
        return new Response(null, { status: 201 })
      }
      if (method === "PATCH") {
        const id = dec.match(/event_id=eq\.([^&]+)/)?.[1]
        const hit = log.filter((r) => r.event_id === id); hit.forEach((r) => Object.assign(r, body))
        return new Response(JSON.stringify(hit), { status: 200 })
      }
      return new Response(JSON.stringify(log), { status: 200 })
    }
    if (table === "landing_leads") return new Response(JSON.stringify(leads), { status: 200 })
    if (table === "landing_lead_activities") return new Response("[]", { status: 200 })
    return new Response("{}", { status: 200 })
  }))
}
const lead = (o: Row = {}) => ({ id: crypto.randomUUID(), product: "omra", offer: "Omra Ramadan complet", phone: "21698140514", first_name: "Sana", visitor_id: "v1", ip: "1.2.3.4", user_agent: "UA", fbp: "fb.1.1.1", fbc: "fb.1.1.2", landing_page: "/p/omra-ramadan-complet", booking_value: null, tracking_consent: true, is_test: false, anonymized_at: null, ...o })
const ok = () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
const ko = () => new Response(JSON.stringify({ error: { message: "Service temporarily unavailable", type: "OAuthException", code: 2 } }), { status: 500 })
beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache()
  log = []; leads = []; metaBodies = []; logUnavailable = false; seq = 0; metaOutcome = ok
  vi.stubEnv("LANDING_SUPABASE_URL", DB); stub()
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("premier envoi journalisé", () => {
  it("envoi réussi : une ligne « sent », 1 tentative, aucune donnée personnelle dans le journal", async () => {
    const l = lead(); leads = [l]
    const r = await sendMetaLogged(buildConversionEvent(l, "QualifiedLead", { eventId: `qualified-${l.id}` }), { leadId: l.id })
    expect(r.ok).toBe(true)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ lead_id: l.id, network: "meta", event_name: "QualifiedLead", event_id: `qualified-${l.id}`, status: "sent", attempts: 1, next_retry_at: null })
    const text = JSON.stringify(log[0])
    for (const pii of ["21698140514", "Sana", "1.2.3.4", "fb.1.1", "UA"]) expect(text).not.toContain(pii)
    expect(Number.isFinite(log[0].event_time)).toBe(true)
  })

  it("Meta en panne : ligne « failed », raison technique courte, prochaine tentative planifiée ; le résultat n'est jamais une exception", async () => {
    metaOutcome = ko
    const l = lead(); leads = [l]
    const r = await sendMetaLogged(buildConversionEvent(l, "Purchase", { eventId: `purchase-${l.id}`, value: 5900 }), { leadId: l.id, valueTnd: 5900 })
    expect(r.ok).toBe(false)
    expect(log[0]).toMatchObject({ status: "failed", attempts: 1, value_tnd: 5900 })
    expect(log[0].last_error).toMatch(/OAuthException/)
    expect(log[0].last_error.length).toBeLessThanOrEqual(200)
    expect(Date.parse(log[0].next_retry_at)).toBeGreaterThan(Date.now())
  })

  it("Meta non configuré : ligne « skipped », jamais de relance", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", ""); vi.stubEnv("META_PIXEL_ID", "")
    const l = lead(); leads = [l]
    await sendMetaLogged(buildConversionEvent(l, "QualifiedLead", { eventId: `qualified-${l.id}` }), { leadId: l.id })
    expect(log[0]).toMatchObject({ status: "skipped", next_retry_at: null })
    expect(metaBodies).toHaveLength(0)
  })

  it("même évènement deux fois : le second n'est PAS envoyé (unicité), un seul appel à Meta", async () => {
    const l = lead(); leads = [l]
    const ev = buildConversionEvent(l, "Purchase", { eventId: `purchase-${l.id}`, value: 100 })
    await sendMetaLogged(ev, { leadId: l.id }); const second = await sendMetaLogged(ev, { leadId: l.id })
    expect(second).toMatchObject({ ok: false, skipped: true })
    expect(metaBodies).toHaveLength(1)
    expect(log).toHaveLength(1)
  })

  it("journal indisponible (migration non appliquée) : l'envoi a lieu quand même, comportement historique, aucune erreur", async () => {
    logUnavailable = true
    const l = lead(); leads = [l]
    const r = await sendMetaLogged(buildConversionEvent(l, "QualifiedLead", { eventId: `qualified-${l.id}` }), { leadId: l.id })
    expect(r.ok).toBe(true)
    expect(metaBodies).toHaveLength(1)
    expect(await retryConversions()).toEqual({ examined: 0, sent: 0, failed: 0, skipped: 0, expired: 0 })
    expect(await conversionStats()).toBeNull()
  })

  it("sans lead enregistré (base indisponible) : envoi sans journal", async () => {
    const l = lead()
    await sendMetaLogged(buildConversionEvent(l, "Lead", { eventId: "lead-evt-00001" }), { leadId: null })
    expect(log).toHaveLength(0); expect(metaBodies).toHaveLength(1)
  })
})

describe("relance", () => {
  const failedRow = (l: Row, o: Row = {}) => ({ id: ++seq, lead_id: l.id, network: "meta", event_name: "Purchase", event_id: `purchase-${l.id}`, event_time: Math.floor(Date.now() / 1000) - 3600, value_tnd: 5900, status: "failed", attempts: 1, created_at: new Date(Date.now() - 7_200_000).toISOString(), next_retry_at: new Date(Date.now() - 60_000).toISOString(), last_error: "x", sent_at: null, ...o })

  it("une vente non transmise est RELANCÉE avec le même identifiant, la même heure et la même valeur, puis marquée « sent »", async () => {
    const l = lead({ booking_value: 5900 }); leads = [l]; log = [failedRow(l)]
    const r = await retryConversions()
    expect(r).toMatchObject({ examined: 1, sent: 1, failed: 0 })
    expect(log[0]).toMatchObject({ status: "sent", attempts: 2, next_retry_at: null })
    const ev = metaBodies[0].data[0]
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: `purchase-${l.id}`, event_time: log[0].event_time })
    expect(ev.custom_data.value).toBe(5900)
  })

  it("échecs répétés : délais croissants, puis abandon après 5 tentatives (plus de prochaine tentative)", async () => {
    metaOutcome = ko
    const l = lead(); leads = [l]; log = [failedRow(l, { attempts: 1 })]
    for (let i = 2; i <= MAX_ATTEMPTS; i++) {
      log[0].next_retry_at = new Date(Date.now() - 1000).toISOString()
      await retryConversions()
      expect(log[0].attempts).toBe(i)
    }
    expect(log[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, next_retry_at: null })
    expect(await retryConversions()).toMatchObject({ examined: 0 }) // abandonnée : plus relancée
    expect(await conversionStats()).toMatchObject({ failed: 0, abandoned: 1 })
    expect(RETRY_DELAYS_MIN.length).toBe(4)
  })

  it("pas avant l'heure prévue", async () => {
    const l = lead(); leads = [l]; log = [failedRow(l, { next_retry_at: new Date(Date.now() + 3_600_000).toISOString() })]
    expect(await retryConversions()).toMatchObject({ examined: 0 })
    expect(metaBodies).toHaveLength(0)
  })

  it("lead de test, sans consentement de suivi, anonymisé ou introuvable : jamais envoyé, marqué « skipped »", async () => {
    const t = lead({ is_test: true }), nc = lead({ tracking_consent: false }), an = lead({ anonymized_at: "2026-11-01T00:00:00Z" }), gone = lead()
    leads = [t, nc, an]; log = [failedRow(t), failedRow(nc), failedRow(an), failedRow(gone)]
    const r = await retryConversions()
    expect(r).toMatchObject({ examined: 4, skipped: 4, sent: 0 })
    expect(metaBodies).toHaveLength(0)
    expect(log.map((x) => x.last_error)).toEqual(["lead de test", "sans consentement de suivi", "lead anonymisé", "lead introuvable"])
  })

  it("évènement de plus de 7 jours : « expired » (Meta le refuserait), jamais envoyé", async () => {
    const l = lead(); leads = [l]; log = [failedRow(l, { event_time: Math.floor(Date.now() / 1000) - META_MAX_AGE_S - 600 })]
    expect(await retryConversions()).toMatchObject({ expired: 1, sent: 0 })
    expect(log[0].status).toBe("expired"); expect(metaBodies).toHaveLength(0)
  })

  it("« pending » resté bloqué (arrêt brutal) : relancé après 10 minutes, jamais avant", async () => {
    const l = lead(); leads = [l]
    log = [failedRow(l, { status: "pending", attempts: 0, next_retry_at: null, created_at: new Date(Date.now() - 120_000).toISOString() })]
    expect(await retryConversions()).toMatchObject({ examined: 0 })
    log[0].created_at = new Date(Date.now() - 20 * 60_000).toISOString()
    expect(await retryConversions()).toMatchObject({ sent: 1 })
  })

  it("une ligne déjà « sent » n'est jamais renvoyée (même si la base la renvoie à tort)", async () => {
    const l = lead(); leads = [l]; log = [failedRow(l, { status: "sent", attempts: 1, next_retry_at: null })]
    expect(await retryConversions()).toMatchObject({ examined: 0 })
    expect(metaBodies).toHaveLength(0)
  })
})

describe("intégration CRM : la vente non transmise est rattrapée", () => {
  it("réservation pendant une panne Meta : vente enregistrée, conversion journalisée « failed », puis envoyée à la relance", async () => {
    metaOutcome = ko
    const l = lead({ tracking_consent: true }); leads = [l]
    const row = { ...l, status: "nouveau", booked_at: null, last_name: null } as unknown as LeadRow
    const res = await changeStatus(row, "reserve", { id: null, label: "t" }, { bookingValue: 5900 })
    expect(res.ok).toBe(true)
    const purchase = log.find((x) => x.event_name === "Purchase")!
    expect(purchase).toMatchObject({ status: "failed", value_tnd: 5900 })
    metaOutcome = ok; purchase.next_retry_at = new Date(Date.now() - 1000).toISOString()
    leads = [{ ...l, booking_value: 5900 }]
    expect(await retryConversions()).toMatchObject({ sent: 1 })
    expect(log.find((x) => x.event_name === "Purchase")!.status).toBe("sent")
    expect(metaBodies.at(-1).data[0].event_id).toBe(`purchase-${l.id}`)
  })
})

describe("utilitaires et route de relance", () => {
  it("safeError : raison courte, sans le corps de la requête, bornée à 200 caractères", () => {
    expect(safeError({ error: { type: "OAuthException", code: 190, message: "Invalid token" } })).toBe("OAuthException · 190 · Invalid token")
    expect(safeError("x".repeat(500)).length).toBe(200)
    expect(safeError(undefined)).toBe("échec d'envoi")
    expect(safeError(new Error("boom"))).toBe("boom")
  })
  it("outcomePatch : sent / skipped / failed avec la bonne échéance", () => {
    const now = Date.parse("2026-11-20T10:00:00Z")
    expect(outcomePatch({ ok: true }, 2, now)).toMatchObject({ status: "sent", attempts: 2, next_retry_at: null })
    expect(outcomePatch({ ok: false, skipped: true }, 1, now)).toMatchObject({ status: "skipped" })
    expect(outcomePatch({ ok: false }, 1, now)).toMatchObject({ status: "failed", next_retry_at: "2026-11-20T10:15:00.000Z" })
    expect(outcomePatch({ ok: false }, 3, now)).toMatchObject({ next_retry_at: "2026-11-20T16:00:00.000Z" })
    expect(outcomePatch({ ok: false }, MAX_ATTEMPTS, now)).toMatchObject({ next_retry_at: null })
  })
  it("route cron : 503 sans secret, 401 sans le bon jeton, 200 avec compteurs seulement", async () => {
    vi.stubEnv("CRON_SECRET", "")
    expect((await cronGET(new Request("https://x.test/api/cron/retry-conversions"))).status).toBe(503)
    vi.stubEnv("CRON_SECRET", "secret-de-test-0123456789")
    expect((await cronGET(new Request("https://x.test/x"))).status).toBe(401)
    expect((await cronGET(new Request("https://x.test/x", { headers: { authorization: "Bearer mauvais" } }))).status).toBe(401)
    const ok200 = await cronGET(new Request("https://x.test/x", { headers: { authorization: "Bearer secret-de-test-0123456789" } }))
    expect(ok200.status).toBe(200)
    const j = await ok200.json()
    expect(Object.keys(j).sort()).toEqual(["examined", "expired", "failed", "ok", "sent", "skipped"])
  })
})
