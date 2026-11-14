// Bloc VIDÉO du Créateur : fichier du site uniquement (aucune ressource tierce), affiche obligatoire, chargement à la demande.
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { sanitizeDesign } from "@/lib/page-builder/design"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let View: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  View = (await import("@/app/p/[slug]/LandingView")).LandingView
})

const category = (o: Partial<Category> = {}): Category => ({ id: "c1", slug: "demo", name: "Page Démo", product: "voyage", lang: "fr", headline: "Accroche démo", description: "Présentation démo du produit.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: "2026-11-13", ...o })
const offer = (o: Partial<PublicOffer> = {}): PublicOffer => ({ id: "o1", category_id: "c1", product: "voyage", name: "Départ 1", sku: null, tag: null, destination: "Turquie", departure_date: "2027-03-10", nights: 7, nights_detail: null, price: 2350, price_before: null, seats_total: 20, seats_sold: 3, features: ["Vol", "Hôtel"], description: "Jour 1 : arrivée", image_url: "https://x.test/o.jpg", visible: true, position: 0, ...o })

const V = (o: Record<string, unknown> = {}) => ({ id: "v0001", type: "video", title: "Vidéo publicitaire", text: "Découvrez le programme.", images: ["/omra-ramadan-2027-poster.jpg"], video: "/omra-ramadan-2027.mp4", ...o })
const clean = (o: Record<string, unknown> = {}) => sanitizeDesign({ blocks: [V(o)] }, "omra")

describe("bloc vidéo : validation", () => {
  it("accepte un fichier .mp4 ou .webm du site avec son affiche", () => {
    const a = clean()
    expect(a.errors).toEqual({})
    expect(a.design.blocks[0]).toMatchObject({ type: "video", video: "/omra-ramadan-2027.mp4", images: ["/omra-ramadan-2027-poster.jpg"] })
    expect(clean({ video: "/videos/offre.webm" }).errors).toEqual({})
  })
  it("refuse toute adresse externe, relative au protocole, remontante ou d'un autre format ; le bloc est écarté", () => {
    for (const bad of ["https://cdn.test/v.mp4", "http://x.test/v.mp4", "//evil.test/v.mp4", "/../secret.mp4", "/a/../b.mp4", "/video.mov", "/video.mp4?x=1", "video.mp4", "javascript:alert(1)", "/v.mp4\" onerror=\"x", ""]) {
      const r = clean({ video: bad })
      expect(r.errors.block0, bad).toBeTruthy()
      expect(r.design.blocks, bad).toHaveLength(0)
    }
  })
  it("l'image d'affiche est obligatoire et ne peut pas être externe non sécurisée", () => {
    expect(clean({ images: [] }).errors.block0).toContain("affiche")
    expect(clean({ images: ["//evil.test/p.jpg"] }).errors.block0).toBeTruthy()
  })
  it("le champ vidéo est vide pour tous les autres types de blocs (aucune fuite)", () => {
    const r = sanitizeDesign({ blocks: [{ id: "t0001", type: "text", title: "T", text: "x", video: "/omra-ramadan-2027.mp4" }] }, "omra")
    expect(r.design.blocks[0].video).toBe("")
  })
})

describe("bloc vidéo : rendu public", () => {
  const render = (design: ReturnType<typeof clean>["design"]) => renderToStaticMarkup(createElement(View, { category: category({ product: "omra", lang: "ar" }), offers: [offer({ product: "omra" })], design }))
  it("affiche un lecteur chargé à la demande, avec l'affiche et la source du site, sans service tiers", () => {
    const h = render(clean().design)
    expect(h).toContain('data-block-type="video"')
    expect(h).toContain('preload="none"')
    expect(h).toContain('poster="/omra-ramadan-2027-poster.jpg"')
    expect(h).toContain('src="/omra-ramadan-2027.mp4"')
    expect(h).toContain('type="video/mp4"')
    expect(h).toContain("Découvrez le programme.")
    for (const tiers of ["youtube", "vimeo", "facebook.com/plugins", "<iframe"]) expect(h).not.toContain(tiers)
  })
  it("une vidéo .webm est annoncée en video/webm ; le titre est échappé", () => {
    const h = render(clean({ video: "/a/b.webm", title: "<b>Titre</b>" }).design)
    expect(h).toContain('type="video/webm"')
    expect(h).not.toContain("<b>Titre</b>")
  })
})

describe("modèle « Omra Ramadan complet » : vidéo incluse", () => {
  it("le préréglage contient le bloc vidéo (fichiers réellement présents dans public/), placé juste après la présentation", async () => {
    const { THEMES } = await import("@/lib/page-builder/themes")
    const { existsSync } = await import("node:fs")
    const preset = THEMES.find((t) => t.id === "ramadan-complet")!.preset!
    const r = sanitizeDesign(preset.design, "omra")
    expect(r.errors).toEqual({})
    const v = r.design.blocks.find((b) => b.type === "video")!
    expect(v.video).toBe("/omra-ramadan-complet.mp4")
    expect(existsSync(new URL(`../public${v.video}`, import.meta.url))).toBe(true)
    expect(existsSync(new URL(`../public${v.images[0]}`, import.meta.url))).toBe(true)
    const keys = r.design.sections.map((x) => x.key)
    expect(keys.indexOf("block:vid0001")).toBe(keys.indexOf("intro") + 1)
  })
})
