// Numéros de téléphone en arabe (affichage inversé corrigé), logo d'en-tête agrandi, carte de l'hôtel (adresse et distance indicative).
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { isolateNumbers, PhoneText } from "@/lib/design-system/bidi"
import { sanitizeDesign } from "@/lib/page-builder/design"
import { THEMES } from "@/lib/page-builder/themes"
import type { Category, PublicOffer } from "@/lib/server/catalog"


vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })
const ROOT = new URL("..", import.meta.url).pathname
const theme = THEMES.find((t) => t.id === "ramadan-complet")!
const page = () => renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "omra-ramadan-complet", product: "omra", lang: "ar", name: "عمرة رمضان كامل" }), offers: [offer({ product: "omra" })], design: sanitizeDesign(theme.preset!.design, "omra").design }))

describe("numéros de téléphone dans une phrase arabe", () => {
  it("un numéro est isolé en gauche-droite (sinon « 98 140 514 » s'affiche « 140 98 514 »)", () => {
    const h = renderToStaticMarkup(createElement("p", null, isolateNumbers("الاتصال على 98 140 514 للحصول على الإمكانية")))
    expect(h).toContain('<bdi dir="ltr" class="whitespace-nowrap">98 140 514</bdi>')
  })
  it("les dates, prix et pourcentages ne sont PAS isolés (5 900, 15 ديسمبر 2026, 50%, 1448)", () => {
    for (const x of ["5 900 د.ت", "15 ديسمبر 2026", "عربون 50% قبل", "1448 هـ · 8 فيفري 2027", "من 2 إلى 11 سنة", "حوالي 2,2 إلى 2,7 كم"]) expect(renderToStaticMarkup(createElement("p", null, isolateNumbers(x)))).not.toContain("<bdi")
  })
  it("formats internationaux isolés aussi (+216 98 140 514)", () => {
    expect(renderToStaticMarkup(createElement("p", null, isolateNumbers("اتصل بـ +216 98 140 514 الآن")))).toContain(">+216 98 140 514</bdi>")
  })
  it("sur la page : le numéro des conditions est isolé ; en-tête et pied de page isolent aussi leur numéro", () => {
    const h = page()
    expect(h).toContain("98 140 514</bdi>")
    expect(renderToStaticMarkup(createElement(PhoneText, null, "98 140 514"))).toMatch(/<bdi dir="ltr" class="whitespace-nowrap" style="unicode-bidi:isolate">98 140 514<\/bdi>/)
    for (const f of ["Easy2BookHeader", "Easy2BookFooter"]) expect(readFileSync(ROOT + `app/components/easy2book/${f}.tsx`, "utf8")).toMatch(/<PhoneText>/)
  })
})

describe("logo d'en-tête et de pied de page", () => {
  it("logo agrandi et apparent : 64 px sur mobile, 84 px sur ordinateur (en-tête), 80 px (pied de page) ; nom de la marque en grand", () => {
    const hdr = readFileSync(ROOT + "app/components/easy2book/Easy2BookHeader.tsx", "utf8"), ftr = readFileSync(ROOT + "app/components/easy2book/Easy2BookFooter.tsx", "utf8")
    expect(hdr).toMatch(/w-16 h-16 sm:w-\[84px\] sm:h-\[84px\]/); expect(hdr).toMatch(/h-\[76px\] sm:h-\[92px\]/); expect(hdr).toMatch(/text-xl sm:text-2xl/)
    expect(ftr).toMatch(/w-20 h-20/)
  })
})

describe("carte de l'hôtel de La Mecque", () => {
  it("adresse et distance communiquées, distance présentée comme APPROXIMATIVE, aucune durée de marche, aucun équipement non confirmé", () => {
    const h = page()
    for (const x of ["مكة المكرمة، حي العزيزية، منطقة محبس الجن، شارع الطحان", "حوالي 2,2 إلى 2,7 كم (مسافة تقريبية)"]) expect(h).toContain(x)
    for (const x of ["دقيقة مشياً", "دقائق مشياً", "واي فاي", "خزنة", "موقف", "القرب من الحرم"]) expect(h).not.toContain(x)
  })
})
