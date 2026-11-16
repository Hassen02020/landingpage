// Photos et fiche de l'hôtel de La Mecque (fournies par le propriétaire) : fichiers optimisés, bloc image + texte, galerie, aucune promesse non confirmée.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, statSync } from "node:fs"
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
const FILES = ["maysan-facade", "maysan-restaurant", "maysan-restaurant-entree", "maysan-lavabo", "maysan-douche"].map((n) => `public/hotel/${n}.jpg`)
const theme = THEMES.find((t) => t.id === "ramadan-complet")!
const html = () => renderToStaticMarkup(createElement(LandingView, { category: category({ slug: "omra-ramadan-complet", product: "omra", lang: "ar", name: "عمرة رمضان كامل" }), offers: [offer({ product: "omra" })], design: sanitizeDesign(theme.preset!.design, "omra").design }))

describe("photos de l'hôtel", () => {
  it("les cinq fichiers existent et sont légers (≤ 200 Ko chacun, 500 Ko au total)", () => {
    let total = 0
    for (const f of FILES) { expect(existsSync(ROOT + f)).toBe(true); const k = statSync(ROOT + f).size / 1024; expect(k).toBeLessThanOrEqual(200); total += k }
    expect(total).toBeLessThanOrEqual(500)
  })
  it("le préréglage passe la validation sans erreur ; bloc image + texte puis galerie, placés après les services", () => {
    const r = sanitizeDesign(theme.preset!.design, "omra")
    expect(r.errors).toEqual({})
    const ids = r.design.blocks.map((b) => b.id); expect(ids).toEqual(["vid0001", "hot0001", "hot0002"])
    expect(r.design.blocks[1].type).toBe("image_text"); expect(r.design.blocks[2].type).toBe("gallery"); expect(r.design.blocks[2].images).toHaveLength(4)
    const keys = r.design.sections.map((s) => s.key); expect(keys.indexOf("services")).toBeLessThan(keys.indexOf("block:hot0001")); expect(keys.indexOf("block:hot0002")).toBeLessThan(keys.indexOf("offers"))
  })
  it("rendu : fiche de l'hôtel (distances, 362 chambres, services, aéroport) et photos servies depuis le site", () => {
    const h = html()
    for (const x of ["فندق ميسان الملتزم — مكة المكرمة", "نحو 2,7 كم من المسجد الحرام (مسافة تقريبية)", "7 كم من غار حراء", "362 غرفة", "حي العزيزية، منطقة محبس الجن، شارع الطحان", "مكتب استقبال يعمل على مدار 24 ساعة", "94 كم"]) expect(h).toContain(x)
    for (const f of FILES) expect(h).toContain(f.replace("public", ""))
  })
  it("PROMESSES NON CONFIRMÉES INTERDITES : pas de « بار » (fiche d'origine, à confirmer), pas de durée de marche, pas de Wi-Fi ni de parking", () => {
    const h = html()
    for (const x of ["بار ", "مشياً", "واي فاي", "موقف", "خزنة"]) expect(h).not.toContain(x)
  })
})
