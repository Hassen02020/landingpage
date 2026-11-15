// E2 — conformité sans changement de fond : contraste du bouton WhatsApp, langue de la page, bandeau de cookies traduit, image de partage.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { sanitizeDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"


vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const ROOT = new URL("..", import.meta.url).pathname
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const theme = THEMES.find((t) => t.id === "ramadan-complet")!
const html = (lang: "ar" | "fr" | "en" = "ar") => renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "omra-ramadan-complet", product: "omra", lang, name: "عمرة رمضان كامل" }), offers: [offer({ product: "omra" })], design: sanitizeDesign(theme.preset!.design, "omra").design }))

describe("E2 : contraste du bouton WhatsApp (WCAG 2.2 AA, 4,5:1)", () => {
  it("le vert d'origine #25D366 ne passait pas ; le vert utilisé passe, et plus aucun bouton de la page n'utilise l'ancien", () => {
    expect(contrast("#ffffff", "#25d366")).toBeLessThan(4.5)
    const h = html()
    expect(h).not.toMatch(/25D366/i)
    expect(h).toContain("bg-[#0e7a3c]")
    expect(contrast("#ffffff", "#0e7a3c")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", "#0b6a33")).toBeGreaterThanOrEqual(4.5) // état « survol »
  })
})

describe("E2 : langue de la page", () => {
  it.each(["ar", "fr", "en"] as const)("la page %s déclare sa langue (lang) et l'annonce au bandeau de cookies (data-page-lang)", (lang) => {
    const h = html(lang)
    expect(h).toContain(`lang="${lang}"`); expect(h).toContain(`data-page-lang="${lang}"`)
  })
  it("le sens de lecture suit la langue (RTL arabe seulement)", () => { expect(html("ar")).toContain('dir="rtl"'); expect(html("fr")).toContain('dir="ltr"') })
})

describe("E2 : bandeau de cookies", () => {
  const src = readFileSync(ROOT + "app/components/TrackingConsent.tsx", "utf8")
  it("trois langues, lues depuis la page ; /omra reste arabe ; sans page annoncée : français", () => {
    expect(src).toMatch(/data-page-lang/)
    for (const t of ["Nous utilisons des traceurs", "We use Meta and TikTok trackers", "نستعمل ملفات تعريف الارتباط"]) expect(src).toContain(t)
    expect(src).toMatch(/pathname\?\.startsWith\("\/omra"\) \? "ar" : "fr"/)
  })
  it("la logique de consentement n'a pas bougé (mêmes choix, mêmes pixels chargés seulement après « granted »)", () => {
    expect(src).toMatch(/choose\("denied"\)/); expect(src).toMatch(/choose\("granted"\)/); expect(src).toMatch(/consent === "granted" && pixels/)
  })
})

describe("E2 : image de partage de /p/<adresse>", () => {
  const cat = (banner: string | null) => ({ ...category({ slug: "x", name: "Page X", headline: "Accroche" }), banner_desktop: banner, banner_mobile: null })
  async function meta(banner: string | null) {
    vi.resetModules()
    vi.doMock("@/lib/server/db", () => ({ dbConfigured: () => true, withPublicOrg: (f: () => unknown) => f() }))
    vi.doMock("@/lib/server/catalog", () => ({ lookupPublicCategory: async () => ({ status: "found", data: { category: cat(banner), offers: [] } }) }))
    vi.doMock("@/lib/server/page-design", () => ({ publicDesign: async () => null }))
    vi.doMock("next/navigation", () => ({ redirect: () => { throw new Error("redirect") } }))
    vi.doMock("@/lib/server/public-errors", () => ({ unavailable: (...a: unknown[]) => new Error(String(a)) }))
    const m = await import("@/app/p/[slug]/page")
    return m.generateMetadata({ params: { slug: "x" } })
  }
  it("sans bannière : image de marque 1200×630 (jamais de lien partagé sans image)", async () => {
    const m = await meta(null)
    const img = (m.openGraph as { images: { url: string; width?: number; height?: number }[] }).images[0]
    expect(img.url).toMatch(/\/og-easy2book\.jpg$/); expect(img.width).toBe(1200); expect(img.height).toBe(630)
  })
  it("avec une bannière : la bannière de la page est conservée", async () => {
    const m = await meta("https://x.test/banner.jpg")
    expect((m.openGraph as { images: { url: string }[] }).images[0].url).toBe("https://x.test/banner.jpg")
  })
  it("la page reste hors des moteurs de recherche (noindex inchangé)", async () => { expect((await meta(null)).robots).toEqual({ index: false, follow: true }) })
})
