// Rendu PUBLIC des pages du Créateur (/p/<adresse>) par famille de page : structure propre à chaque produit, sections pilotées par les DONNÉES RÉELLES (rien d'inventé), aperçu inerte.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { sanitizeDesign } from "@/lib/page-builder/design"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let CategoryView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  CategoryView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const html = (c: Category, offers: PublicOffer[], preview = false) => renderToStaticMarkup(createElement(CategoryView, { category: c, offers, preview }))

describe("rendu public par famille", () => {
  it("chaque famille a sa propre apparence et sa propre structure de sections", () => {
    const fam = (product: Category["product"]) => html(category({ product }), [offer({ product })])
    const [omra, voyage, hotel, autre] = [fam("omra"), fam("voyage"), fam("hotel"), fam("autre")]
    expect(omra).toContain('data-family="omra"'); expect(omra).toContain("emerald")
    expect(voyage).toContain('data-family="voyage"'); expect(voyage).toContain("blue")
    expect(hotel).toContain('data-family="hotel"'); expect(hotel).toContain("teal")
    expect(autre).toContain('data-family="autre"'); expect(autre).toContain("violet")
    // structure : « points forts » et « galerie » n'existent que pour la famille voyage ; « programme » ni pour l'hôtel ni pour l'offre
    expect(voyage).toContain("Les points forts")
    for (const h of [omra, hotel, autre]) expect(h).not.toContain("Les points forts")
    expect(omra).toContain('id="programme"'); expect(voyage).toContain('id="programme"')
    expect(hotel).not.toContain('id="programme"'); expect(autre).not.toContain('id="programme"')
  })
  it("sections pilotées par les données : sans prestations ni programme ni image, ces sections n'apparaissent PAS (rien d'inventé)", () => {
    const h = html(category({ description: null, headline: null }), [offer({ features: [], description: null, image_url: null })])
    for (const s of ["Prestations incluses", "Programme", "En images", "Les points forts"]) expect(h).not.toContain(s)
    expect(h).toContain("Questions fréquentes"); expect(h).toContain('id="reservation"'); expect(h).toContain('id="offres"')
  })
  it("prestations dédoublonnées entre offres ; programme par offre ; galerie seulement avec ≥ 2 images distinctes", () => {
    const h = html(category(), [offer({ id: "a", features: ["Vol", "Hôtel"], image_url: "https://x.test/1.jpg" }), offer({ id: "b", name: "Départ 2", features: ["vol", "Guide"], image_url: "https://x.test/2.jpg", description: "Jour 1 : B" })])
    expect((h.match(/✓ Guide/g) ?? []).length).toBeGreaterThanOrEqual(1)
    expect(h).toContain("En images")
    expect(h).toContain("Départ 2")
    const one = html(category(), [offer({ image_url: "https://x.test/1.jpg" })])
    expect(one).not.toContain("En images")
  })
  it("prix et dates réels uniquement : prix barré seulement s'il est supérieur ; places seulement si suivies ; complet signalé", () => {
    const h = html(category({ product: "autre" }), [offer({ product: "autre", price: 100, price_before: 150, seats_total: null }), offer({ id: "b", name: "Complet", seats_total: 5, seats_sold: 5 })])
    expect(h).toContain("150"); expect(h).toContain("line-through"); expect(h).toContain("Promotion"); expect(h).toContain("Complet")
    expect(html(category(), [offer({ price_before: 50 })])).not.toContain("line-through")
    expect(html(category(), [offer({ seats_total: null })])).not.toContain("Plus que")
  })
  it("page en arabe : direction de droite à gauche et textes arabes ; en français : gauche à droite", () => {
    const ar = html(category({ lang: "ar", product: "omra" }), [offer({ product: "omra" })])
    expect(ar).toContain('dir="rtl"'); expect(ar).toContain("أسئلة شائعة")
    expect(html(category(), [offer()])).toContain('dir="ltr"')
  })
  it("aperçu : formulaire et boutons INERTES (fieldset désactivé), bandeau « Aperçu » ; la page publique n'a ni l'un ni l'autre", () => {
    const p = html(category(), [offer()], true)
    expect(p).toContain("<fieldset disabled"); expect(p).toContain("Aperçu")
    const pub = html(category(), [offer()], false)
    expect(pub).not.toContain("<fieldset disabled"); expect(pub).not.toContain("Aperçu :")
  })
  it("formulaire : formId et niche liés à l'adresse de la page (attribution), boutons Réserver et WhatsApp présents", () => {
    const h = html(category({ slug: "turquie-ete-2027" }), [offer()])
    expect(h).toContain('id="category-turquie-ete-2027"'); expect(h).toContain("Réserver cette offre"); expect(h).toContain("wa.me/")
  })
  it("FAQ : processus de réservation seulement, aucun chiffre inventé", () => {
    const h = html(category(), [offer()])
    expect(h).toContain("Comment réserver ?"); expect(h).toContain("Les prix affichés sont-ils définitifs ?")
  })
})

describe("rendu avec personnalisation (design)", () => {
  const withDesign = (raw: unknown, product: Category["product"] = "voyage") => renderToStaticMarkup(createElement(CategoryView, { category: category({ product }), offers: [offer({ product, price_before: 3000, price: 2400 })], design: sanitizeDesign(raw, product === "voyage" ? "voyage" : "autre").design }))
  it("SANS design (null) : rendu strictement identique au rendu par défaut", () => {
    const base = renderToStaticMarkup(createElement(CategoryView, { category: category(), offers: [offer()] }))
    expect(renderToStaticMarkup(createElement(CategoryView, { category: category(), offers: [offer()], design: null }))).toBe(base)
    expect(base).not.toContain("data-custom-colors")
  })
  it("design vide (valeurs par défaut) : même apparence que sans design (aucune couleur imposée)", () => {
    const h = withDesign({})
    expect(h).not.toContain("data-custom-colors"); expect(h).toContain("blue")
  })
  it("injection impossible : balises, scripts et styles dans les textes sont ÉCHAPPÉS ; une couleur piégée est refusée", () => {
    const h = withDesign({ faq: [{ q: "<script>alert(1)</script>", a: "<img src=x onerror=alert(2)>" }], testimonials: [{ name: "<b>X</b>", text: "\"><svg onload=1>" }], cta: { label: "<i>Go</i>" }, colors: { custom: "red;background:url(javascript:1)" } })
    expect(h).not.toContain("<script>alert"); expect(h).not.toContain("<img src=x"); expect(h).not.toContain("<svg onload"); expect(h).not.toContain("<b>X</b>"); expect(h).not.toContain("<i>Go</i>")
    expect(h).toContain("&lt;script&gt;")
    expect(h).not.toContain("javascript:1"); expect(h).not.toContain("data-custom-colors")
  })
  it("réglages appliqués : couleur, bouton, prix barré masqué, « À partir de » masqué, ordre, e-mail", () => {
    const h = withDesign({ colors: { custom: "#1d4ed8" }, cta: { label: "Réservez" }, price: { prefix: false, showBefore: false }, form: { email: true }, sections: [{ key: "faq", visible: true }] })
    expect(h).toContain('data-custom-colors="yes"'); expect(h).toContain("--p:#1d4ed8"); expect(h).toContain("Réservez")
    expect(h).not.toContain("line-through"); expect(h).not.toContain("À partir de"); expect(h).toContain('name="email"')
    expect(h.indexOf('id="faq"')).toBeLessThan(h.indexOf('id="offres"'))
  })
})
