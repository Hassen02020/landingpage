import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { open, seal } from "@/lib/server/secret-box"
import { resetIntegrationCache, resolveIntegration, saveIntegration, testIntegration, validateInput, publicPixelIds } from "@/lib/server/integrations"
import { checkLead, normalizeBlockValue, resetProtectionCache } from "@/lib/server/protection"
import { promoStatus, validatePromo, type PromoRow } from "@/lib/server/promo"
import { groupBy, groupByOffer, parsePeriod, rates, teamStats, totals, type LeadStatRow } from "@/lib/server/stats"
import { calculate } from "@/lib/calculator"
import { sendMetaEvent } from "@/lib/server/meta"
import { configureAll, installFetchMock, post } from "./helpers"
import { POST as leadsPOST } from "@/app/api/leads/route"

const META_TOKEN = "EAA" + "B".repeat(150)
const actor = { id: null, label: "direction@easy2book.tn" }

beforeEach(() => {
  resetIntegrationCache()
  resetProtectionCache()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("chiffrement des jetons", () => {
  it("chiffre (AES-GCM), déchiffre, et refuse une autre clé ou une altération", () => {
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
    const sealed = seal(META_TOKEN)
    expect(sealed).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/)
    expect(sealed).not.toContain("EAA")
    expect(seal(META_TOKEN)).not.toBe(sealed) // IV aléatoire
    expect(open(sealed)).toBe(META_TOKEN)
    // altération GARANTIE : un caractère du texte chiffré est remplacé par un caractère DIFFÉRENT (l'ancien test remplaçait par « A » ou « B »
    // sans vérifier que le caractère changeait : environ 1 fois sur 64 le jeton restait intact et le test échouait au hasard)
    const [version, iv, tag, data] = sealed.split(":")
    const flipped = (data[0] === "A" ? "B" : "A") + data.slice(1)
    const tampered = [version, iv, tag, flipped].join(":")
    expect(tampered).not.toBe(sealed)
    expect(() => open(tampered)).toThrow(/illisible/)
    // idem pour le sceau d'authentification (tag) et le vecteur d'initialisation
    expect(() => open([version, iv, (tag[0] === "A" ? "B" : "A") + tag.slice(1), data].join(":"))).toThrow(/illisible/)
    expect(() => open([version, (iv[0] === "A" ? "B" : "A") + iv.slice(1), tag, data].join(":"))).toThrow(/illisible/)
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "autre-cle-serveur-9876543210")
    expect(() => open(sealed)).toThrow(/illisible/)
  })
})

describe("intégrations Meta / TikTok gérées depuis /admin", () => {
  it("valide les saisies (pixel 15-17 chiffres, jeton EAA…, refuse une adresse e-mail)", () => {
    expect(validateInput("meta", { enabled: true, pixelId: "tarhouni.hassene@gmail.com", token: "", clearToken: false, testEventCode: "" }).pixelId).toBeTruthy()
    expect(validateInput("meta", { enabled: true, pixelId: "1674012850599992", token: '"EAAB 123"', clearToken: false, testEventCode: "" }).token).toBeTruthy()
    expect(validateInput("meta", { enabled: true, pixelId: "1674012850599992", token: META_TOKEN, clearToken: false, testEventCode: "TEST123" })).toEqual({})
  })

  it("sans réglage /admin : variables Vercel (comportement actuel inchangé)", async () => {
    configureAll()
    installFetchMock()
    const cfg = await resolveIntegration("meta")
    expect(cfg).toMatchObject({ enabled: true, pixelId: "111", token: "meta-test-token", pixelSource: "vercel", tokenSource: "vercel" })
  })

  it("le réglage /admin remplace Vercel, le jeton est stocké chiffré, le journal ne contient aucune valeur", async () => {
    configureAll()
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
    const f = installFetchMock()
    const res = await saveIntegration("meta", { enabled: true, pixelId: "1674012850599992", token: META_TOKEN, clearToken: false, testEventCode: "" }, actor)
    expect(res).toEqual({ ok: true })
    const row = f.db.landing_integrations[0]
    expect(row.token_ciphertext).toMatch(/^v1:/)
    expect(JSON.stringify(f.db)).not.toContain(META_TOKEN)
    expect(row.token_last4).toBe("BBBB")
    expect(f.db.landing_integration_changes[0].summary).toContain("jeton remplacé")

    await sendMetaEvent({ eventName: "Lead", eventId: "evt-12345678", user: {} })
    const call = f.meta().at(-1)!
    expect(call.url).toBe("https://graph.facebook.com/v21.0/1674012850599992/events")
    expect(call.body.access_token).toBe(META_TOKEN)
  })

  it("désactivée dans /admin : aucun envoi serveur ni pixel navigateur, même avec Vercel", async () => {
    configureAll()
    const f = installFetchMock()
    await saveIntegration("meta", { enabled: false, pixelId: "", token: "", clearToken: false, testEventCode: "" }, actor)
    expect(await sendMetaEvent({ eventName: "Lead", eventId: "evt-12345678", user: {} })).toEqual({ ok: false, skipped: true })
    expect(f.meta()).toHaveLength(0)
    expect((await publicPixelIds()).meta).toBeNull()
  })

  it("test Meta : lit le pixel avec le jeton en en-tête (jamais dans l'URL), message clair si code 190", async () => {
    configureAll()
    installFetchMock()
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = String(url)
      calls.push({ url: u, init })
      if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ error: { code: 190, message: "The access token could not be decrypted" } }), { status: 400 })
      return new Response("[]", { status: 200 })
    }))
    const r = await testIntegration("meta", actor)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/code 190/)
    const meta = calls.find((c) => c.url.includes("graph.facebook.com"))!
    expect(meta.url).not.toContain("meta-test-token")
    expect((meta.init.headers as Record<string, string>).Authorization).toBe("Bearer meta-test-token")
  })

  it("test Meta sans code de test : un refus de lecture du pixel (code 100) n'est pas présenté comme un pixel introuvable", async () => {
    configureAll()
    installFetchMock()
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      if (String(url).includes("graph.facebook.com")) return new Response(JSON.stringify({ error: { code: 100, message: "Unsupported get request" } }), { status: 400 })
      return new Response("[]", { status: 200 })
    }))
    const r = await testIntegration("meta", actor)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/code de test/)
    expect(r.message).not.toMatch(/introuvable/)
  })

  it("test Meta avec code de test : envoie UN événement de test (POST /events) et réussit sur events_received", async () => {
    configureAll()
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
    const f = installFetchMock()
    await saveIntegration("meta", { enabled: false, pixelId: "1674012850599992", token: META_TOKEN, clearToken: false, testEventCode: "TEST12345" }, actor)
    const calls: { url: string; init: RequestInit }[] = []
    const base = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = String(url)
      if (u.includes("graph.facebook.com")) {
        calls.push({ url: u, init })
        return new Response(JSON.stringify({ events_received: 1, messages: [], fbtrace_id: "x" }), { status: 200 })
      }
      return base(url as string, init)
    }))
    const r = await testIntegration("meta", actor)
    expect(r.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/1674012850599992/events")
    expect(calls[0].init.method).toBe("POST")
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.test_event_code).toBe("TEST12345")
    expect(body.data).toHaveLength(1)
    expect(String(calls[0].init.body)).not.toContain(META_TOKEN)
    expect(f.db.landing_integrations[0].last_test_ok).toBe(true)
  })
})

describe("protection des formulaires", () => {
  it("normalise les numéros et IP à bloquer", () => {
    expect(normalizeBlockValue("phone", "98 140 514")).toBe("21698140514")
    expect(normalizeBlockValue("phone", "abc")).toBeNull()
    expect(normalizeBlockValue("ip", "102.45.12.8")).toBe("102.45.12.8")
    expect(normalizeBlockValue("ip", "999.1.1.1")).toBeNull()
  })

  it("bloque numéro, IP, pays non autorisé ; pays inconnu accepté ; base indisponible = accepté", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_blocklist = [{ kind: "phone", value: "21698140514", active: true }, { kind: "ip", value: "10.9.9.9", active: true }]
    f.db.landing_protection = [{ id: 1, allowed_countries: ["TN", "FR"] }]
    expect(await checkLead({ phone: "21698140514" })).toEqual({ blocked: true, reason: "phone" })
    expect(await checkLead({ phone: "21622123456", ip: "10.9.9.9" })).toEqual({ blocked: true, reason: "ip" })
    expect(await checkLead({ phone: "21622123456", country: "US" })).toEqual({ blocked: true, reason: "country" })
    expect(await checkLead({ phone: "21622123456", country: "FR" })).toEqual({ blocked: false })
    expect(await checkLead({ phone: "21622123456", country: null })).toEqual({ blocked: false })
    resetProtectionCache()
    installFetchMock({ dbStatus: 500 })
    expect(await checkLead({ phone: "21698140514" })).toEqual({ blocked: false })
  })

  it("/api/leads refuse un numéro bloqué (403) sans rien enregistrer", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_blocklist = [{ kind: "phone", value: "21698140514", active: true }]
    const res = await leadsPOST(post("/api/leads", { name: "Spam Test", phone: "98140514", product: "omra", contactConsent: true }))
    expect(res.status).toBe(403)
    expect(f.db.landing_leads).toHaveLength(0)
  })
})

describe("codes promo", () => {
  const base: PromoRow = { id: 1, code: "RAMADAN27", title: "R", discount_type: "percent", discount_value: 10, product: "omra", starts_on: null, ends_on: null, max_uses: 2, used_count: 0, active: true, created_at: "" }
  it("statut : actif, programmé, expiré, épuisé, désactivé", () => {
    expect(promoStatus(base, "2027-01-10")).toBe("active")
    expect(promoStatus({ ...base, starts_on: "2027-02-01" }, "2027-01-10")).toBe("scheduled")
    expect(promoStatus({ ...base, ends_on: "2027-01-01" }, "2027-01-10")).toBe("expired")
    expect(promoStatus({ ...base, used_count: 2 }, "2027-01-10")).toBe("exhausted")
    expect(promoStatus({ ...base, active: false }, "2027-01-10")).toBe("disabled")
  })
  it("validation de la création", () => {
    expect(validatePromo({ code: "ramadan 27", title: "Remise", discountType: "percent", discountValue: "10", product: "omra", startsOn: "", endsOn: "", maxUses: "" }).row).toMatchObject({ code: "RAMADAN27", discount_value: 10, max_uses: null })
    expect(validatePromo({ code: "x", title: "", discountType: "percent", discountValue: "150", product: "", startsOn: "2027-02-01", endsOn: "2027-01-01", maxUses: "-1" }).errors).toMatchObject({ code: expect.any(String), title: expect.any(String), discountValue: expect.any(String), endsOn: expect.any(String), maxUses: expect.any(String) })
  })
  it("/api/leads : code valide enregistré + compté + dans le message WhatsApp ; code invalide refusé (422)", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_promo_codes = [{ ...base }]
    const ok = await leadsPOST(post("/api/leads", { name: "Ahmed Ben Ali", phone: "22123456", product: "omra", contactConsent: true, promo_code: "ramadan27" }))
    const json = await ok.json()
    expect(json.ok).toBe(true)
    expect(f.db.landing_leads[0].promo_code).toBe("RAMADAN27")
    expect(f.db.landing_promo_codes[0].used_count).toBe(1)
    expect(decodeURIComponent(json.whatsappUrl)).toContain("Code promo : RAMADAN27 (-10 %)")

    const bad = await leadsPOST(post("/api/leads", { name: "Sami Test", phone: "23123456", product: "omra", contactConsent: true, promo_code: "FAUX" }))
    expect(bad.status).toBe(422)
    expect((await bad.json()).errors.promo_code).toBeTruthy()
    expect(f.db.landing_leads).toHaveLength(1)
  })
})

describe("statistiques marketing et équipe", () => {
  const L = (o: Partial<LeadStatRow>): LeadStatRow => ({ status: "nouveau", booking_value: null, channel: "facebook", utm_campaign: "omra-2027", utm_term: "femmes-35", utm_content: "video-1", campaign_id: null, adset_id: null, ad_id: null, assigned_to: null, ...o })
  const rows = [
    L({ status: "reserve", booking_value: "11000", assigned_to: "u1" }),
    L({ status: "perdu", assigned_to: "u1" }),
    L({ status: "contacte", utm_content: "video-2" }),
    L({ status: "nouveau", channel: "tiktok", utm_campaign: null, campaign_id: "123" }),
  ]
  it("totaux, taux et regroupements campagne / groupe / annonce", () => {
    const c = totals(rows)
    expect(c).toMatchObject({ leads: 4, reserve: 1, perdu: 1, revenue: 11000 })
    const r = rates(c)
    expect(r.treatmentRate).toBe(0.75)
    expect(r.closingRate).toBe(0.5)
    expect(groupBy(rows, "campaign").map((g) => [g.channel, g.campaign, g.leads])).toEqual([["facebook", "omra-2027", 3], ["tiktok", "#123", 1]])
    expect(groupBy(rows, "ad").filter((g) => g.channel === "facebook")).toHaveLength(2)
    expect(groupByOffer([L({ product: "omra", offer: "الفوج الثاني" }), L({ product: "omra", offer: "الفوج الثاني" })])[0]).toMatchObject({ offer: "الفوج الثاني", leads: 2 })
  })
  it("équipe : actions et taux de conclusion par membre", () => {
    const staff = [{ user_id: "u1", email: "a@e.tn", full_name: "Agent A", role: "agent" as const, active: true }]
    const acts = [
      { actor_id: "u1", type: "status_change", to_status: "contacte" as const },
      { actor_id: "u1", type: "status_change", to_status: "reserve" as const },
      { actor_id: "u1", type: "status_change", to_status: "perdu" as const },
      { actor_id: "u1", type: "note", to_status: null },
    ]
    expect(teamStats(staff, acts, rows)[0]).toMatchObject({ name: "Agent A", assigned: 2, actions: 4, notes: 1, contacted: 1, booked: 1, lost: 1, closingRate: 0.5 })
  })
  it("période par défaut : 30 jours, bornes inversées remises dans l'ordre", () => {
    const p = parsePeriod()
    expect(p.from <= p.to).toBe(true)
    expect(parsePeriod("2027-02-10", "2027-01-01")).toEqual({ from: "2027-01-01", to: "2027-02-10" })
  })
})

describe("calculateur de rentabilité", () => {
  it("calcule budget, réservations, marge, profit, ROAS et coût par lead maximal", () => {
    const r = calculate({ costPerLead: 8, leads: 100, contactRate: 80, bookingRate: 10, peoplePerBooking: 2, pricePerPerson: 5500, costPerPerson: 4800, otherCostPerBooking: 50 })
    expect(r.adBudget).toBe(800)
    expect(r.bookings).toBeCloseTo(8)
    expect(r.people).toBeCloseTo(16)
    expect(r.revenue).toBeCloseTo(88000)
    expect(r.grossMargin).toBeCloseTo(16 * 700 - 8 * 50)
    expect(r.profit).toBeCloseTo(10800 - 800)
    expect(r.breakEvenCostPerLead).toBeCloseTo(108)
    expect(r.roas).toBeCloseTo(110)
  })
  it("ne produit jamais NaN avec des champs vides ou négatifs", () => {
    const r = calculate({ costPerLead: -1, leads: 0, contactRate: 150, bookingRate: NaN, peoplePerBooking: 0, pricePerPerson: 0, costPerPerson: 0, otherCostPerBooking: 0 })
    expect(Object.values(r).every((v) => Number.isFinite(v))).toBe(true)
  })
})
