import { describe, expect, it } from "vitest"
import { ARCHIVED_POSITION, copySlug, filterPages, isArchived, lifecycleOf, normalizeQuery, summarize, type DashItem } from "@/lib/page-builder/dashboard"
import type { Category } from "@/lib/server/catalog"
import type { PageStatus } from "@/lib/page-status"

const st = (ok: boolean): PageStatus => ({ state: ok ? "prete" : "offres_expirees", ok, validOffers: ok ? 1 : 0, expiredOffers: 0, soldOutOffers: 0, label: ok ? "Prête" : "Offres expirées", detail: "", tone: ok ? "ok" : "bad" })
const item = (slug: string, o: Partial<Category> = {}, ok = true): DashItem => ({ category: { id: slug, slug, name: o.name ?? slug, product: "voyage", lang: "fr", headline: null, description: null, banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: false, position: 0, updated_at: "2026-11-13", ...o }, status: st(ok), offers: 1 })
const ITEMS = [
  item("turquie-ete", { name: "Turquie Été", visible: true }),
  item("omra-ramadan", { name: "Omra Ramadan", product: "omra", visible: true }, false),
  item("brouillon-hotel", { name: "Hôtel Djerba", product: "hotel" }),
  item("ancienne", { name: "Ancienne", position: ARCHIVED_POSITION }),
]

describe("tableau de bord : cycle de vie", () => {
  it("brouillon / publiée / archivée ; une page publiée n'est jamais « archivée »", () => {
    expect(lifecycleOf({ visible: false, position: 0 })).toBe("brouillon")
    expect(lifecycleOf({ visible: true, position: 0 })).toBe("publiee")
    expect(lifecycleOf({ visible: false, position: ARCHIVED_POSITION })).toBe("archivee")
    expect(lifecycleOf({ visible: true, position: ARCHIVED_POSITION })).toBe("publiee")
    expect(isArchived({ visible: true, position: ARCHIVED_POSITION })).toBe(false)
  })
  it("compteurs : les archivées sont à part ; « à corriger » = publiée dont le lien ne peut pas recevoir de publicité", () => {
    expect(summarize(ITEMS)).toEqual({ total: 3, brouillons: 1, publiees: 2, archivees: 1, aCorriger: 1 })
  })
})

describe("tableau de bord : filtres et recherche", () => {
  it("la vue par défaut exclut les archivées ; chaque onglet filtre son état", () => {
    expect(filterPages(ITEMS, {}).map((i) => i.category.slug)).toEqual(["turquie-ete", "omra-ramadan", "brouillon-hotel"])
    expect(filterPages(ITEMS, { vue: "brouillon" }).map((i) => i.category.slug)).toEqual(["brouillon-hotel"])
    expect(filterPages(ITEMS, { vue: "publiee" })).toHaveLength(2)
    expect(filterPages(ITEMS, { vue: "archivee" }).map((i) => i.category.slug)).toEqual(["ancienne"])
  })
  it("recherche sans accent ni casse (nom, adresse) et filtre produit", () => {
    expect(filterPages(ITEMS, { q: "DJERBA" }).map((i) => i.category.slug)).toEqual(["brouillon-hotel"])
    expect(filterPages(ITEMS, { q: "hotel" }).map((i) => i.category.slug)).toEqual(["brouillon-hotel"])
    expect(filterPages(ITEMS, { q: "ramadan" })).toHaveLength(1)
    expect(filterPages(ITEMS, { produit: "omra" }).map((i) => i.category.slug)).toEqual(["omra-ramadan"])
    expect(filterPages(ITEMS, { q: "introuvable" })).toEqual([])
  })
  it("paramètres d'adresse invalides ignorés (aucune injection, valeurs par défaut)", () => {
    expect(normalizeQuery({ vue: "<script>", produit: "x", q: "a".repeat(500) })).toEqual({ vue: "toutes", produit: "", q: "a".repeat(80) })
  })
})

describe("adresse d'une copie", () => {
  it("« -copie », puis « -copie-2 » ; jamais déjà utilisée ; 60 caractères maximum", () => {
    expect(copySlug("turquie", [])).toBe("turquie-copie")
    expect(copySlug("turquie", ["turquie-copie"])).toBe("turquie-copie-2")
    expect(copySlug("turquie", ["turquie-copie", "turquie-copie-2"])).toBe("turquie-copie-3")
    const long = copySlug("a".repeat(60), [])
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith("-copie")).toBe(true)
  })
})
