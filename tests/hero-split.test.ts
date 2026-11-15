// En-tête « split » (texte + carte vidéo verticale), avis étoilés et estimation indicative du formulaire (page Omra Ramadan complet).
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { defaultDesign, sanitizeDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"
import { REVIEW_PAGE_KEYS } from "@/lib/review-pages"
import { REVIEW_PAGES } from "@/lib/server/reviews"


vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const theme = THEMES.find((t) => t.id === "ramadan-complet")!
const design = () => sanitizeDesign(theme.preset!.design, "omra").design
const view = (slug: string, d = design()) => renderToStaticMarkup(createElement(LandingView, { category: category({ slug, product: "omra", lang: "ar", name: "عمرة رمضان كامل", headline: theme.preset!.headline, description: theme.preset!.description }), offers: [offer({ product: "omra", name: "غرفة ثنائية", price: 6900, departure_date: null, nights: null })], design: d }))

describe("en-tête split", () => {
  it("défaut « standard » ; seule la valeur « split » est acceptée", () => {
    expect(defaultDesign("omra").hero).toBe("standard")
    expect(sanitizeDesign({ hero: "split" }, "omra").design.hero).toBe("split")
    expect(sanitizeDesign({ hero: "<script>" }, "omra").design.hero).toBe("standard")
  })
  it("le modèle Ramadan complet utilise l'en-tête split", () => { expect(design().hero).toBe("split") })
  it("rendu : vidéo dans l'en-tête (une seule fois), texte non dupliqué, prix de départ calculé, pas d'avis inventé", () => {
    const h = view("omra-ramadan-complet")
    expect(h).toContain('data-testid="hero-split"')
    expect((h.match(/data-testid="block-video"/g) ?? []).length).toBe(1)
    expect(h.indexOf('data-testid="block-video"')).toBeLessThan(h.indexOf('id="services"'))
    expect((h.match(/برنامج متكامل من Easy2Book/g) ?? []).length).toBe(1)
    expect(h).toMatch(/ابتداءً من <span dir="ltr">6\D900<\/span>/) // « à partir de » = prix du catalogue
    expect(h).not.toContain('data-testid="testimonials"')
  })
  it("sans « split » le rendu reste celui d'avant (bandeau, vidéo en bloc, texte d'introduction)", () => {
    const d = design(); d.hero = "standard"
    const h = view("autre-page", d)
    expect(h).not.toContain('data-testid="hero-split"'); expect(h).toContain('id="bloc-vid0001"'); expect(h).toContain("برنامج متكامل من Easy2Book")
  })
})

describe("en-tête et pied de page du site sur les pages du Créateur", () => {
  it("présents sur une page publiée, avec menu d'ancres vers des sections réelles", () => {
    const h = view("omra-ramadan-complet")
    expect(h).toContain('data-testid="brochure-header"'); expect(h).toContain('data-testid="brochure-footer"'); expect(h).toContain('aria-label="Navigation principale"'); expect(h).toMatch(/logo\.png/)
    const std = view("autre-page", { ...design(), hero: "standard" }); expect(std).toContain("<header"); expect(std).toContain("<footer"); expect(std).not.toContain('data-testid="brochure-header"')
    for (const id of ["video", "services", "offres", "avis", "faq", "reservation"]) expect(h).toContain(`id="${id}"`)
    for (const href of ["#video", "#services", "#offres", "#avis", "#faq"]) expect(h).toContain(`href="${href}"`)
    expect(h).toContain("tel:+216")
  })
  it("absents de l'aperçu de l'administration", () => {
    const h = renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "x", product: "omra", lang: "ar" }), offers: [offer({ product: "omra" })], design: design(), preview: true }))
    expect(h).not.toContain("<footer"); expect(h).not.toContain('aria-label="Navigation principale"')
  })
})

describe("avis étoilés sur la page Ramadan", () => {
  it("la liste des pages d'avis est partagée entre le serveur et le navigateur", () => {
    expect(Array.from(REVIEW_PAGES).sort()).toEqual(Array.from(REVIEW_PAGE_KEYS).sort())
    expect(REVIEW_PAGE_KEYS).toContain("omra-ramadan-complet")
  })
  it("section d'avis affichée avant le formulaire uniquement pour une page autorisée", () => {
    const yes = view("omra-ramadan-complet"), no = view("autre-page")
    expect(yes).toContain('id="avis"'); expect(yes.indexOf('id="avis"')).toBeLessThan(yes.indexOf('id="reservation"'))
    expect(no).not.toContain('id="avis"')
  })
  it("les pages des trois départs (Groupe 1, Groupe 2, Chawwal) acceptent aussi les avis, avec leur propre note", () => {
    for (const slug of ["omra-foj-1", "omra-foj-2", "omra-chawwal"]) { expect(REVIEW_PAGES.has(slug)).toBe(true); expect(view(slug)).toContain('id="avis"') }
  })
})
