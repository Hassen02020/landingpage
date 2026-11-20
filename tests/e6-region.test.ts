// E6 — région FACULTATIVE sur la page Omra Ramadan (décision du propriétaire : région facultative, type de demande abandonné, ni WhatsApp ni consentement modifiés).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { handleLeadPost } from "@/lib/server/lead-intake"
import { resetProtectionCache } from "@/lib/server/protection"
import { REGIONS } from "@/lib/regions"
import { CONSENT_TEXT_VERSION } from "@/lib/config"
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

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
beforeEach(() => resetProtectionCache())
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const ROOT = new URL("..", import.meta.url).pathname
let n = 0
const mk = (o: Record<string, unknown> = {}) => ({ name: "Ahmed Ben Ali", phone: `9815${String(1000 + ++n).slice(-4)}`, product: "omra", contactConsent: true, ...o })

describe("E6 : serveur", () => {
  it("région de la liste officielle : enregistrée", async () => {
    configureAll(); const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk({ region: "Sousse" })))
    expect((await res.json()).ok).toBe(true)
    expect(f.db.landing_leads[0].region).toBe("Sousse")
  })
  it("toutes les valeurs de la liste sont acceptées ; toute autre valeur est ignorée sans erreur (le lead est quand même créé)", async () => {
    configureAll(); const f = installFetchMock()
    for (const r of ["Atlantide", "sousse", "<script>", "", 42, null, ["Tunis"]]) await leadsPOST(post("/api/leads", mk({ region: r })))
    expect(f.db.landing_leads).toHaveLength(7)
    for (const row of f.db.landing_leads) expect(row.region).toBeUndefined()
    expect(REGIONS.length).toBeGreaterThanOrEqual(24)
    const g = installFetchMock(); configureAll()
    await leadsPOST(post("/api/leads", mk({ region: REGIONS[0] })))
    expect(g.db.landing_leads[0].region).toBe(REGIONS[0])
  })
  it("sans région : rien n'est enregistré (comportement historique)", async () => {
    configureAll(); const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk()))
    expect(f.db.landing_leads[0].region).toBeUndefined()
  })
  it("le consentement de contact reste OBLIGATOIRE même avec une région", async () => {
    configureAll(); installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk({ region: "Tunis", contactConsent: false })))
    expect(res.status).toBe(422)
  })
  it("consentements, version du texte, e-mail et message WhatsApp inchangés : la région n'apparaît ni dans le message WhatsApp ni dans le consentement", async () => {
    configureAll(); const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk({ region: "Sfax", marketingConsent: true })))
    const json = await res.json()
    expect(f.db.landing_leads[0]).toMatchObject({ contact_consent: true, marketing_consent: true, consent_text_version: CONSENT_TEXT_VERSION })
    expect(decodeURIComponent(json.whatsappUrl)).not.toContain("Sfax"); expect(decodeURIComponent(json.whatsappUrl)).not.toMatch(/Région|الولاية/)
  })
  it("anti-doublon inchangé : même événement = même lead, la région ne crée pas de doublon", async () => {
    configureAll(); const f = installFetchMock()
    const body = mk({ region: "Nabeul", eventId: "evt-e6-0001" })
    await leadsPOST(post("/api/leads", body)); const second = await (await leadsPOST(post("/api/leads", body))).json()
    expect(second.duplicate).toBe(true); expect(f.db.landing_leads).toHaveLength(1)
  })
  it("entreprise cliente (platform: false) : la région n'est jamais acceptée", async () => {
    configureAll(); const f = installFetchMock()
    await handleLeadPost(post("/api/o/bob/leads", mk({ region: "Sousse" })), { platform: false, orgSlug: "bob" })
    for (const row of f.db.landing_leads) expect(row.region).toBeUndefined()
  })
  it("base sans la colonne région (avant 0006) : le lead n'est jamais perdu", () => {
    expect(readFileSync(ROOT + "lib/server/lead-intake.ts", "utf8")).toMatch(/"email", "region", "age_range", "contact_channel"/)
  })
})

describe("E6 : formulaire et réglage de page", () => {
  const theme = THEMES.find((t) => t.id === "ramadan-complet")!
  const html = (form: { email: boolean; region: boolean; age?: boolean }, askAge = form.age === true) => renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "omra-ramadan-complet", product: "omra", lang: "ar", name: "عمرة رمضان كامل" }), offers: [offer({ product: "omra" })], design: { ...sanitizeDesign(theme.preset!.design, "omra").design, form: { ...form, age: askAge, destinations: [] } } }))
  it("réglage désactivé par défaut ; seul le modèle Ramadan l'active", () => {
    expect(defaultDesign("omra").form.region).toBe(false)
    expect(sanitizeDesign({ form: { region: "oui" } }, "omra").design.form.region).toBe(false)
    expect(sanitizeDesign({ form: { region: true } }, "omra").design.form.region).toBe(true)
    expect(sanitizeDesign(theme.preset!.design, "omra").design.form.region).toBe(true)
    for (const id of ["omra-groupe-1", "omra-groupe-2", "omra-chawwal", "voyage-organise", "hotel"]) expect(sanitizeDesign(THEMES.find((t) => t.id === id)!.preset?.design ?? {}, "omra").design.form.region).toBe(false)
  })
  it("menu de région affiché seulement si le réglage est actif, avec libellé arabe et les gouvernorats de la liste", () => {
    const on = html({ email: false, region: true }), off = html({ email: false, region: false })
    expect(on).toContain('data-testid="region-select"'); expect(on).toContain("الولاية (اختياري)")
    for (const r of REGIONS) expect(on).toContain(`<option value="${r}">`)
    expect(off).not.toContain('data-testid="region-select"')
  })
  it("le formulaire n'envoie la région que si le menu est affiché (aucun champ caché)", () => {
    const src = readFileSync(ROOT + "app/components/LeadCaptureForm.tsx", "utf8")
    expect(src).toMatch(/region: askRegion \? get\("region"\) \|\| undefined : undefined/)
  })
  it("la page publique et le formulaire des autres pages restent sans menu de région", () => {
    expect(readFileSync(ROOT + "app/p/[slug]/LandingView.tsx", "utf8")).toMatch(/askRegion=\{design\?\.form\.region === true\}/)
  })
})
