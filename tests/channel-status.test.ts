// Pilotage des canaux (lot C). États déduits de faits observés ; aucun appel réseau.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { SILENCE_DAYS, channelReport, type ChannelFacts } from "@/lib/channel-status"
import { loadChannelReports } from "@/lib/server/channels"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const NOW = new Date("2026-11-22T12:00:00Z")
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const f = (o: Partial<ChannelFacts> = {}): ChannelFacts => ({ configured: true, lastEventAt: null, events7d: 0, dropped7d: 0, lastTestOk: null, lastTestAt: null, ...o })

describe("états", () => {
  it("non connecté : aucune intégration, pas d'alerte", () => { const r = channelReport("messenger", f({ configured: false }), NOW); expect(r).toMatchObject({ state: "not_connected", alert: false }) })
  it("connecté sans aucun événement : NON PROUVÉ, avec alerte", () => { const r = channelReport("whatsapp", f(), NOW); expect(r).toMatchObject({ state: "connected_unproven", alert: true }); expect(r.headline).toMatch(/non prouvé/i) })
  it("un test réussi ne vaut PAS preuve de fonctionnement", () => { const r = channelReport("tiktok", f({ lastTestOk: true, lastTestAt: ago(12) }), NOW); expect(r.state).toBe("connected_unproven"); expect(r.detail).toMatch(/rien ne prouve/) })
  it("dernier test non concluant et rien jamais reçu : alerte « non concluant », fonctionnement non prouvé", () => {
    const r = channelReport("meta_conversions", f({ lastTestOk: false, lastTestAt: ago(12), lastTestMessage: "jeton sans droit de lecture du pixel" }), NOW)
    expect(r).toMatchObject({ state: "failing", alert: true }); expect(r.headline).toMatch(/non concluant/); expect(r.detail).toMatch(/jeton sans droit/)
  })
  it("un événement réel récent l'emporte sur un test non concluant : le canal FONCTIONNE", () =>
    expect(channelReport("meta_conversions", f({ lastTestOk: false, lastTestAt: ago(12), lastEventAt: ago(3), events7d: 1 }), NOW)).toMatchObject({ state: "receiving", alert: false }))
  it("un événement ancien (hors 7 jours) avec un test non concluant : silencieux, pas « en échec »", () =>
    expect(channelReport("meta_conversions", f({ lastTestOk: false, lastEventAt: ago(12), events7d: 0 }), NOW).state).toBe("silent"))
  it("événements récents : fonctionne", () => expect(channelReport("whatsapp", f({ lastEventAt: ago(1), events7d: 5 }), NOW)).toMatchObject({ state: "receiving", alert: false }))
  it("a reçu puis plus rien depuis plus de 7 jours : silencieux", () => {
    expect(channelReport("whatsapp", f({ lastEventAt: ago(SILENCE_DAYS + 1), events7d: 0 }), NOW)).toMatchObject({ state: "silent", alert: true })
    expect(channelReport("whatsapp", f({ lastEventAt: ago(SILENCE_DAYS - 1), events7d: 2 }), NOW).state).toBe("receiving")
  })
  it("événements perdus : dégradé, même si le canal reçoit", () => expect(channelReport("whatsapp", f({ lastEventAt: ago(0), events7d: 3, dropped7d: 2 }), NOW)).toMatchObject({ state: "degraded", alert: true }))
  it("téléphone : saisie manuelle, jamais présenté comme automatique", () => {
    expect(channelReport("telephone", f({ manual: true }), NOW)).toMatchObject({ state: "manual", alert: false })
    expect(channelReport("telephone", f({ manual: true, events7d: 4, lastEventAt: ago(0) }), NOW).detail).toMatch(/4 saisie/)
  })
})

describe("PREUVE sur l'état réel de production lu le 22/11/2026 (lecture seule)", () => {
  // Faits lus dans la base : journal des événements entrants VIDE ; numéro WhatsApp …2078 actif depuis le 14/11 ; Meta actif, dernier test en échec (10/11) ;
  // TikTok actif, test réussi (10/11) ; 8 leads de formulaire (dernier le 19/11) ; aucune connexion Messenger ni Instagram.
  const wa = channelReport("whatsapp", f({ configured: true }), NOW)
  // Meta : test du 10/11 « non concluant » (jeton API Conversions sans droit de lecture du pixel) MAIS un Lead réel a été envoyé avec succès le 19/11.
  const meta = channelReport("meta_conversions", f({ configured: true, lastTestOk: false, lastTestAt: "2026-11-10T10:49:29Z", lastEventAt: "2026-11-19T13:51:13Z", events7d: 1 }), NOW)
  const tiktok = channelReport("tiktok", f({ configured: true, lastTestOk: true, lastTestAt: "2026-11-10T20:09:18Z" }), NOW)
  const forms = channelReport("formulaires", f({ configured: true, lastEventAt: "2026-11-19T17:46:02Z", events7d: 8 }), NOW)
  it("WhatsApp : branché mais jamais prouvé", () => expect(wa.state).toBe("connected_unproven"))
  it("Meta : FONCTIONNE (Lead réel envoyé le 19/11) malgré un test non concluant le 10/11", () => expect(meta.state).toBe("receiving"))
  it("TikTok : test réussi mais non prouvé par un événement réel", () => expect(tiktok.state).toBe("connected_unproven"))
  it("formulaires : fonctionne (leads réels reçus)", () => expect(forms.state).toBe("receiving"))
  it("Messenger et Instagram : non connectés", () => { expect(channelReport("messenger", f({ configured: false }), NOW).state).toBe("not_connected"); expect(channelReport("instagram", f({ configured: false }), NOW).state).toBe("not_connected") })
})

describe("chargement côté serveur", () => {
  const ORG = "00000000-0000-4000-8000-0000000e2b01"
  let methods: string[]
  beforeEach(() => {
    configureAll(); resetTenantModeCache(); resetPublicOrgCache(); methods = []
    vi.stubEnv("LANDING_SUPABASE_URL", "https://landing-db.test")
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = decodeURIComponent(String(url)); methods.push((init.method || "GET").toUpperCase())
      if (u.includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
      if (u.includes("landing_whatsapp_numbers")) return new Response(JSON.stringify([{ enabled: true }]), { status: 200 })
      if (u.includes("landing_integrations")) return new Response(JSON.stringify([{ provider: "meta", enabled: true, last_test_ok: false, last_test_at: "2026-11-10T10:49:29Z" }, { provider: "tiktok", enabled: true, last_test_ok: true, last_test_at: "2026-11-10T20:09:18Z" }]), { status: 200 })
      if (u.includes("landing_conversion_log")) return new Response(JSON.stringify([{ sent_at: ago(3) }]), { status: 200 })
      if (u.includes("landing_leads")) return new Response(JSON.stringify([{ created_at: ago(3) }]), { status: 200 })
      if (u.includes("landing_conversations")) return new Response(JSON.stringify({ code: "42P01" }), { status: 404 }) // table absente : fait inconnu, pas d'erreur
      return new Response("[]", { status: 200 })
    }))
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  it("7 canaux, lecture seule, tolère une table absente, reproduit l'état réel (WhatsApp non prouvé, Meta fonctionne)", async () => {
    const r = await loadChannelReports(ORG, NOW)
    expect(r.map((x) => x.id)).toEqual(["formulaires", "whatsapp", "messenger", "instagram", "telephone", "meta_conversions", "tiktok"])
    const by = Object.fromEntries(r.map((x) => [x.id, x.state]))
    expect(by).toMatchObject({ whatsapp: "connected_unproven", messenger: "not_connected", instagram: "not_connected", telephone: "manual", meta_conversions: "receiving", tiktok: "connected_unproven", formulaires: "receiving" })
    expect(methods.every((m) => m === "GET")).toBe(true)
  })
})
