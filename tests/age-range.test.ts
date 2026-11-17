// Lot 6 : tranche d'âge DÉCLARÉE (facultative) — jamais déduite, jamais envoyée aux plateformes, désactivée par défaut.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { handleLeadPost } from "@/lib/server/lead-intake"
import { resetProtectionCache } from "@/lib/server/protection"
import { AGE_LABELS, AGE_RANGES, AGE_TEXT, isAgeRange } from "@/lib/age-range"
import { sanitizeDesign, defaultDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { configureAll, installFetchMock, post } from "./helpers"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})
beforeEach(() => resetProtectionCache())
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const ROOT = new URL("..", import.meta.url).pathname
let n = 0
const mk = (o: Record<string, unknown> = {}) => ({ name: "Ahmed Ben Ali", phone: `9816${String(1000 + ++n).slice(-4)}`, product: "omra", contactConsent: true, ...o })

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })

const esc = (t: string) => t.replace(/'/g, "&#x27;") // le rendu HTML échappe les apostrophes
const render = (askAge: boolean, lang: "fr" | "ar" | "en" = "ar") => renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "omra-ramadan-complet", product: "omra", lang, name: "عمرة" }), offers: [offer({ product: "omra" })], design: { ...sanitizeDesign({}, "omra").design, form: { email: false, region: false, age: askAge } } } as never))

describe("lot 6 : liste contrôlée et réglage de page", () => {
  it("5 tranches, libellés dans les 3 langues, valeurs hors liste refusées", () => {
    expect(AGE_RANGES).toEqual(["18-24", "25-34", "35-44", "45-54", "55+"])
    for (const a of AGE_RANGES) for (const l of ["fr", "en", "ar"] as const) expect(AGE_LABELS[a][l]).toBeTruthy()
    for (const v of ["12-17", "30", "jeune", "", null, undefined, 42, ["25-34"], "25-34 "]) expect(isAgeRange(v)).toBe(false)
  })
  it("réglage DÉSACTIVÉ par défaut, sur tous les modèles ; seule la valeur vraie l'active", () => {
    expect(defaultDesign("omra").form.age).toBe(false)
    for (const t of THEMES) expect(sanitizeDesign(t.preset?.design ?? {}, "omra").design.form.age, t.id).toBe(false)
    expect(sanitizeDesign({ form: { age: "oui" } }, "omra").design.form.age).toBe(false)
    expect(sanitizeDesign({ form: { age: true } }, "omra").design.form.age).toBe(true)
  })
})

describe("lot 6 : formulaire", () => {
  it("menu affiché seulement si le réglage est actif, avec libellé, texte d'information et « je préfère ne pas répondre »", () => {
    for (const lang of ["fr", "ar", "en"] as const) {
      const on = render(true, lang)
      expect(on).toContain('data-testid="age-select"')
      expect(on).toContain(esc(AGE_TEXT[lang].label))
      expect(on).toContain(esc(AGE_TEXT[lang].none))
      expect(on).toContain('data-testid="age-note"')
      for (const a of AGE_RANGES) expect(on).toContain(`<option value="${a}">`)
    }
    const off = render(false)
    expect(off).not.toContain("age-select")
    expect(off).not.toContain("age_range")
  })
  it("le formulaire n'envoie la tranche que si le menu est affiché ; elle n'entre ni dans le message WhatsApp ni dans les évènements publicitaires", () => {
    const src = readFileSync(ROOT + "app/components/LeadCaptureForm.tsx", "utf8")
    expect(src).toMatch(/age_range: askAge \? get\("age_range"\) \|\| undefined : undefined/)
    expect(src).not.toMatch(/trackEvent\([^)]*age_range/)
  })
  it("le texte d'information est écrit pour être validé (aucune promesse de partage ou de déduction)", () => {
    for (const l of ["fr", "en", "ar"] as const) expect(AGE_TEXT[l].note.length).toBeGreaterThan(20)
    expect(AGE_TEXT.fr.note).toMatch(/Facultatif/)
    expect(AGE_TEXT.fr.note).toMatch(/pas partagée/)
  })
})

describe("lot 6 : serveur", () => {
  it("tranche de la liste : enregistrée ; toute autre valeur : ignorée sans erreur, le lead est quand même créé", async () => {
    configureAll(); const f = installFetchMock()
    for (const v of ["12-17", "30", "<script>", "", 42, null, ["25-34"], "25-34 "]) await leadsPOST(post("/api/leads", mk({ age_range: v })))
    expect(f.db.landing_leads).toHaveLength(8)
    for (const row of f.db.landing_leads) expect(row.age_range).toBeUndefined()
    const g = installFetchMock(); configureAll()
    await leadsPOST(post("/api/leads", mk({ age_range: "35-44" })))
    expect(g.db.landing_leads[0].age_range).toBe("35-44")
  })
  it("sans tranche : rien n'est enregistré ; le consentement de contact reste OBLIGATOIRE", async () => {
    configureAll(); const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk()))
    expect(f.db.landing_leads[0].age_range).toBeUndefined()
    expect((await leadsPOST(post("/api/leads", mk({ age_range: "25-34", contactConsent: false })))).status).toBe(422)
  })
  it("JAMAIS envoyée à Meta ni à TikTok (évènement Lead avec consentement de suivi)", async () => {
    configureAll(); const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ age_range: "25-34", trackingConsent: true, eventId: "age-evt-00001" })))
    expect(f.db.landing_leads[0].age_range).toBe("25-34")
    expect(f.meta().length).toBeGreaterThan(0)
    const everything = JSON.stringify(f.calls.filter((c) => /facebook|tiktok/.test(c.url)).map((c) => c.body))
    expect(everything).not.toContain("25-34")
    expect(everything).not.toMatch(/age_range|"ge"/)
  })
  it("pas pour une entreprise cliente (formulaire de /o/…) : ignorée", async () => {
    configureAll(); const f = installFetchMock()
    await handleLeadPost(post("/api/o/x/leads", mk({ age_range: "25-34" })), { platform: false, orgSlug: "x" })
    expect(f.db.landing_leads[0]?.age_range).toBeUndefined()
  })
  it("base SANS la colonne (avant 0027) : le lead n'est jamais perdu, la tranche est simplement ignorée", async () => {
    configureAll(); const f = installFetchMock()
    const inner = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (u: unknown, i?: RequestInit) => {
      if (String(u).includes("/landing_leads") && (i?.method ?? "GET") === "POST" && String(i?.body ?? "").includes("age_range")) return new Response(JSON.stringify({ code: "42703", message: "column \"age_range\" does not exist" }), { status: 400 })
      return inner(u as string, i)
    }))
    const res = await leadsPOST(post("/api/leads", mk({ age_range: "45-54" })))
    expect((await res.json()).ok).toBe(true)
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.db.landing_leads[0].age_range).toBeUndefined()
  })
  it("la liste des colonnes retirées en repli contient age_range (code source)", () => {
    expect(readFileSync(ROOT + "lib/server/lead-intake.ts", "utf8")).toMatch(/"region", "age_range", "contact_channel"/)
  })
})
