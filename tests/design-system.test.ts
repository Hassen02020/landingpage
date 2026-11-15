// E8 — système de composants Easy2Book : rendu, variantes par produit, règles d'identité, arabe, CRM intact.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync, readdirSync } from "node:fs"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { sanitizeDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"
import { AMBIANCES, ambianceForFamily } from "@/lib/design-system/ambiance"
import * as DS from "@/app/components/easy2book"
import { SiteFooter } from "@/app/components/SiteFooter"


vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const ROOT = new URL("..", import.meta.url).pathname
const read = (f: string) => readFileSync(ROOT + f, "utf8")
const r = (el: React.ReactElement) => renderToStaticMarkup(el)
const heading = (t: string) => createElement("h2", null, t)

describe("E8 : bibliothèque de composants", () => {
  it("expose les onze composants demandés et la mascotte", () => {
    for (const n of ["Easy2BookHeader", "Easy2BookFooter", "Easy2BookButton", "Easy2BookHero", "Easy2BookOfferCard", "Easy2BookPriceCard", "Easy2BookTrustSection", "Easy2BookFAQ", "Easy2BookLeadForm", "Easy2BookWhatsAppCTA", "Easy2BookMascot"]) expect(typeof (DS as Record<string, unknown>)[n]).toBe("function")
  })
  it("bouton : variantes de marque, lien ou bouton selon la présence de href", () => {
    expect(r(createElement(DS.Easy2BookButton, { variant: "brand", href: "#x", children: "Réserver" }))).toMatch(/<a [^>]*href="#x"[^>]*class="[^"]*bg-e2b-blue/)
    expect(r(createElement(DS.Easy2BookButton, { variant: "whatsapp", onClick: () => {}, children: "WA" }))).toMatch(/<button [^>]*class="[^"]*bg-e2b-wa/)
  })
  it("WhatsApp : s'ouvre dans un nouvel onglet sans fuite (noopener) ; le suivi reste à la page", () => {
    const h = r(createElement(DS.Easy2BookWhatsAppCTA, { href: "https://wa.me/1", children: "x" }))
    expect(h).toContain('target="_blank"'); expect(h).toContain("noopener noreferrer")
  })
  it("carte d'offre et carte de prix : montants fournis par la page, aucun calcul, complet = bouton remplacé", () => {
    const c = (soldOut: boolean) => r(createElement(DS.Easy2BookOfferCard, { name: "Chambre", price: "5 900", unit: " / pers.", soldOut, labels: { reserve: "R", ask: "A", full: "Complet" }, onReserve: () => {}, askHref: "#", chipClass: "", priceClass: "", buttonClass: "", softClass: "", features: ["Vol"] }))
    expect(c(false)).toContain("5 900"); expect(c(false)).toContain(">R<"); expect(c(true)).toContain("Complet"); expect(c(true)).not.toContain(">R<")
    expect(r(createElement(DS.Easy2BookPriceCard, { title: "Double", price: "6 900", unit: "TND", ctaLabel: "Réserver", onSelect: () => {}, highlight: true }))).toContain("border-e2b-yellow")
  })
  it("hero : titre en deux temps, accent jaune de marque, pas d'accent sans « … »", () => {
    expect(DS.splitHeadline("Un titre… et sa fin")).toEqual({ lead: "Un titre", accent: "et sa fin" })
    expect(DS.splitHeadline("Titre simple")).toBeNull()
    const h = r(createElement(DS.Easy2BookHero, { eyebrow: "E", headline: "A… B", actions: createElement("span") }))
    expect(h).toContain("var(--e2b-yellow)")
  })
  it("réassurance, FAQ : textes bruts échappés par React", () => {
    const t = r(createElement(DS.Easy2BookTrustSection, { title: "T", ariaLabel: "T", items: [{ title: "<b>x</b>", text: "y" }], variant: "icons", accentClass: "", heading }))
    expect(t).toContain("&lt;b&gt;x&lt;/b&gt;"); expect(t).not.toContain("<b>x</b>")
    expect(r(createElement(DS.Easy2BookFAQ, { title: "FAQ", items: [{ q: "Q ?", a: "R" }], heading }))).toContain("<details")
  })
})

describe("E8 : mascotte EAZY (aucun remplaçant)", () => {
  it("n'affiche rien sans fichier officiel", () => {
    expect(r(createElement(DS.Easy2BookMascot, { alt: "EAZY" }))).toBe("")
    expect(r(createElement(DS.Easy2BookMascot, { src: "/x.png", alt: "EAZY" }))).toBe("") // dimensions requises : pas de rendu approximatif
  })
  it("aucun fichier de mascotte n'a été ajouté au dépôt", () => {
    const files = readdirSync(ROOT + "public")
    expect(files.filter((f) => /eazy|mascot/i.test(f))).toEqual([])
  })
})

describe("E8 : ambiances par produit", () => {
  it("huit produits ; seule la surface varie ; couleurs de marque uniquement (aucune valeur en dur)", () => {
    expect(Object.keys(AMBIANCES).sort()).toEqual(["attraction", "boat", "flight", "hotel", "omra", "organized_trip", "package", "transfer"])
    for (const a of Object.values(AMBIANCES)) { expect(a.surface).toMatch(/^bg-e2b-/); expect(a.line).toMatch(/^border-e2b-/); expect(a.surface + a.line).not.toMatch(/#/) }
  })
  it("Omra = crème validé ; les autres reprennent le bleu clair de marque tant qu'elles ne sont pas validées", () => {
    expect(AMBIANCES.omra.status).toBe("valide")
    for (const [k, a] of Object.entries(AMBIANCES)) if (k !== "omra") { expect(a.status).toBe("a-valider"); expect(a.surface).toBe("bg-e2b-blue-soft") }
    expect(ambianceForFamily("omra")).toBe(AMBIANCES.omra); expect(ambianceForFamily("voyage")).toBe(AMBIANCES.organized_trip)
  })
  it("les composants de marque ne contiennent aucune couleur hexadécimale en dur", () => {
    for (const f of readdirSync(ROOT + "app/components/easy2book")) expect(read("app/components/easy2book/" + f)).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})

describe("E8 : arabe", () => {
  it("pied de page du site en arabe : textes arabes, sens droite-gauche, numéro de téléphone lisible, ni majuscules ni espacement des lettres", () => {
    const h = r(createElement(SiteFooter, { whatsappHref: "#", lang: "ar" }))
    for (const x of ["عروضنا", "اتصل بنا", "راسلنا على واتساب", "جميع الحقوق محفوظة", "الإشعارات القانونية", "الخصوصية", "رحلات منظمة", "مركز الحجز"]) expect(h).toContain(x)
    expect(h).toContain('dir="rtl"'); expect(h).toContain('lang="ar"'); expect(h).toContain('<span dir="ltr">+216')
    expect(h).not.toMatch(/Nos offres|Écrire sur WhatsApp|Tous droits|Devis gratuit/); expect(h).not.toMatch(/uppercase|tracking-widest/)
  })
  it("pied de page du site : le français reste la valeur par défaut (autres pages inchangées)", () => {
    const h = r(createElement(SiteFooter, { whatsappHref: "#" }))
    expect(h).toContain("Nos offres"); expect(h).toContain("Écrire sur WhatsApp"); expect(h).toContain("uppercase")
  })
  it("pied de page compact en arabe", () => {
    const h = r(createElement(DS.Easy2BookFooter, { name: "عمرة", phone: "+21698140514", phoneLabel: "98 140 514", whatsappHref: "#", lang: "ar" }))
    for (const x of ["Easy2Book · مركز الحجز", "واتساب", "الإشعارات القانونية"]) expect(h).toContain(x)
    expect(h).not.toContain("Mentions légales"); expect(h).not.toContain("Centrale de Réservation")
  })
  it("page arabe sans en-tête « split » (pages de départ) : pied de page arabe de bout en bout", () => {
    const theme = THEMES.find((t) => t.id === "omra-groupe-1")!
    const h = r(createElement(LandingView, { category: category({ slug: "omra-foj-1", product: "omra", lang: "ar", name: "الفوج الأول" }), offers: [offer({ product: "omra" })], design: sanitizeDesign(theme.preset!.design, "omra").design }))
    expect(h).toContain("عروضنا"); expect(h).not.toContain("Nos offres"); expect(h).not.toContain("Écrire sur WhatsApp")
  })
})

describe("E8 : CRM et formulaire intacts", () => {
  it("le formulaire reçoit exactement les mêmes propriétés ; la chaîne CRM n'est pas touchée", () => {
    const wrapper = read("app/components/easy2book/Easy2BookLeadForm.tsx")
    expect(wrapper).toMatch(/<LeadCaptureForm \{\.\.\.form\} \/>/)
    for (const f of ["lib/server/lead-intake.ts", "lib/server/crm.ts", "lib/server/attribution.ts", "app/api/leads/route.ts"]) expect(read(f)).not.toMatch(/easy2book\//)
  })
})
