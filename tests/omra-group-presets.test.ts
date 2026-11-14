// Modèles « Omra — Groupe 1 / Groupe 2 / Chawwal » du Créateur : mêmes données que /omra, aucune invention.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { sanitizeDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"
import { DEFAULT_PACKAGES } from "@/app/omra/packages"


vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let CategoryView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  CategoryView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const IDS = ["omra-groupe-1", "omra-groupe-2", "omra-chawwal"]
const themes = IDS.map((id) => THEMES.find((t) => t.id === id)!)

describe("modèles des départs Omra", () => {
  it("les trois modèles existent, en arabe, famille omra", () => {
    for (const t of themes) { expect(t).toBeTruthy(); expect(t.family).toBe("omra"); expect(t.lang).toBe("ar"); expect(t.preset).toBeTruthy() }
  })
  it("prix, date et durée = ceux de /omra (source unique de vérité)", () => {
    const expected = DEFAULT_PACKAGES.map((p) => [p.price, p.nights])
    const got = themes.map((t) => [Number(t.preset!.offers[0].price), Number(t.preset!.offers[0].nights)])
    expect(got).toEqual(expected)
    expect(themes.map((t) => t.preset!.offers[0].departure_date)).toEqual(["2027-01-27", "2027-02-18", "2027-03-15"])
    expect(themes.map((t) => t.preset!.offers[0].nights_detail)).toEqual(DEFAULT_PACKAGES.map((p) => p.nightsDetail))
  })
  it("adresses distinctes, sans collision avec /omra ni le modèle Ramadan", () => {
    const slugs = themes.map((t) => t.preset!.slug)
    expect(new Set([...slugs, "omra", "omra-ramadan-complet"]).size).toBe(5)
  })
  it("personnalisation valide (aucune erreur), sans vidéo ni témoignages ni échéance inventée", () => {
    for (const t of themes) {
      const r = sanitizeDesign(t.preset!.design, "omra")
      expect(r.errors).toEqual({})
      const raw = JSON.stringify(t.preset!.design)
      expect(raw).not.toMatch(/"video"|deadline|testimonials":\[\{/)
    }
  })
  it("rendu : services, conditions, FAQ, offre unique avec le bon prix ; pas de témoignage", () => {
    themes.forEach((t, i) => {
      const p = t.preset!, o = p.offers[0]
      const h = renderToStaticMarkup(createElement(CategoryView, {
        category: category({ product: "omra", lang: "ar", name: p.name, headline: p.headline, description: p.description }),
        offers: [offer({ product: "omra", name: o.name, price: Number(o.price), nights: Number(o.nights), nights_detail: o.nights_detail, departure_date: o.departure_date!, features: o.features })],
        design: sanitizeDesign(p.design, "omra").design,
      }))
      expect(h).toContain('data-testid="services"'); expect(h).toContain("فندق أرائك غزة"); expect(h).toContain('data-testid="conditions"')
      expect(h).not.toContain('data-testid="testimonials"'); expect(h).toContain("احجز مكانك الآن"); expect(h).toContain('dir="rtl"')
      expect(h).toContain(String(DEFAULT_PACKAGES[i].price))
    })
  })
})
