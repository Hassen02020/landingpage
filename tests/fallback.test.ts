import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { CATEGORY_FALLBACK, TRACKING_PARAMS, fallbackKind, fallbackTarget, queryString, trackingQuery } from "../lib/fallback"
import { hotelAnchor, slugify, voyageAnchor } from "../lib/anchors"
import { VOYAGES } from "../app/voyages-organises/data"
import { HOTEL_PROMOS } from "../app/summer-vibes/data/hotel-promos"

describe("cible de secours (fonction pure)", () => {
  it("catégorie introuvable (/c ou /p) → /voyages-organises ; AUCUN secours pour une entreprise (404 neutre)", () => {
    expect(fallbackTarget("/c/inconnue")).toBe(CATEGORY_FALLBACK)
    expect(fallbackTarget("/p/inconnue")).toBe(CATEGORY_FALLBACK)
    expect(CATEGORY_FALLBACK).toBe("/voyages-organises")
    expect(fallbackTarget("/o/inconnue")).toBeNull()
    expect(fallbackTarget("/o/inconnue", { utm_source: "a" })).toBeNull()
  })

  it("conserve la query string complète : UTM, identifiants de campagne, clics publicitaires, clés répétées, valeurs encodées", () => {
    const q = { utm_source: "facebook", utm_campaign: "omra-ramadan-2027", fbclid: "IwAR 1/+x", tag: ["a", "b"], vide: undefined }
    const t = fallbackTarget("/c/inconnue", q)!
    const u = new URL(t, "https://x.test")
    expect(u.pathname).toBe("/voyages-organises")
    expect(u.searchParams.get("utm_source")).toBe("facebook")
    expect(u.searchParams.get("utm_campaign")).toBe("omra-ramadan-2027")
    expect(u.searchParams.get("fbclid")).toBe("IwAR 1/+x")
    expect(u.searchParams.getAll("tag")).toEqual(["a", "b"])
    expect(u.searchParams.has("vide")).toBe(false)
    expect(fallbackTarget("/p/inconnue", new URLSearchParams("utm_source=tiktok&ttclid=Z"))).toBe("/voyages-organises?utm_source=tiktok&ttclid=Z")
  })

  it("sans paramètre : aucun « ? » ; chemin accepté avec barre finale, query ou ancre", () => {
    expect(fallbackTarget("/c/x/", {})).toBe("/voyages-organises")
    expect(fallbackTarget("/c/x?utm_source=a#ancre")).toBe("/voyages-organises")
    expect(queryString(null)).toBe("")
    expect(queryString(undefined)).toBe("")
  })

  it("chemins sans secours : accueil, pages existantes, plusieurs segments, autres préfixes → null (le 404 normal s'applique)", () => {
    for (const p of ["/", "/omra", "/voyages-organises", "/c", "/c/", "/c/a/b", "/o/a/b/c", "/x/y", "/admin/c/x", "/C/x", ""]) expect(fallbackTarget(p), p).toBeNull()
    expect(fallbackKind("/c/x")).toBe("category")
    expect(fallbackKind("/o/x")).toBeNull()
    expect(fallbackKind("/p/x")).toBe("category")
    expect(fallbackKind("/c")).toBeNull()
  })

  it("slugs spéciaux : jamais recopiés dans la cible, aucune redirection ouverte possible", () => {
    const odd = ["../../admin", "%2e%2e%2fadmin", "//evil.com", "https:%2F%2Fevil.com", "évènement", "a%00b", "x".repeat(500), "é‮", "javascript:alert(1)", ".", "..", "a b"]
    for (const slug of odd) {
      for (const kind of ["c", "p", "o"]) {
        const t = fallbackTarget(`/${kind}/${slug}`, { utm_source: "a" })
        if (t === null) continue // chemin à plusieurs segments : pas de secours, jamais pire
        expect(t.startsWith("/"), t).toBe(true)
        expect(t.startsWith("//"), t).toBe(false)
        expect(t).not.toMatch(/:\/\//)
        expect(t).not.toContain(slug)
        expect(t).toBe("/voyages-organises?utm_source=a")
        expect(kind, "aucun secours pour une entreprise").not.toBe("o")
      }
    }
  })

  it("un paramètre malveillant dans la query reste de la donnée (encodé), jamais un chemin", () => {
    const t = fallbackTarget("/c/x", { next: "//evil.com", "x\r\nSet-Cookie": "a=b" })!
    expect(t).not.toMatch(/[\r\n]/)
    expect(t.startsWith("/voyages-organises?")).toBe(true)
    expect(new URL(t, "https://x.test").origin).toBe("https://x.test")
  })
})

describe("paramètres de suivi (page 404)", () => {
  it("ne garde que les paramètres de suivi publicitaire", () => {
    expect(trackingQuery(new URLSearchParams("utm_source=fb&foo=1&gclid=G&utm_campaign=c"))).toBe("?utm_source=fb&gclid=G&utm_campaign=c")
    expect(trackingQuery(new URLSearchParams("foo=1"))).toBe("")
  })
  it("la liste est identique à celle de l'attribution (garde contre toute divergence)", () => {
    const src = readFileSync(new URL("../lib/attribution.ts", import.meta.url), "utf8")
    const block = src.slice(src.indexOf("const PARAMS = ["), src.indexOf("] as const", src.indexOf("const PARAMS = [")))
    const attributed = (block.match(/"([a-z_]+)"/g) ?? []).map((s) => s.replace(/"/g, ""))
    expect(Array.from(TRACKING_PARAMS).sort()).toEqual(attributed.sort())
  })
})

describe("ancres par produit", () => {
  const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/
  it("voyages : ancres uniques, valides, et identiques à « voyage-<id> » (l'id existant ne change pas)", () => {
    const anchors = VOYAGES.map((v) => voyageAnchor(v.id))
    expect(new Set(anchors).size).toBe(VOYAGES.length)
    for (const v of VOYAGES) {
      expect(slugify(v.id), v.id).toBe(v.id)
      expect(voyageAnchor(v.id)).toBe(`voyage-${v.id}`)
      expect(voyageAnchor(v.id), v.id).toMatch(VALID)
    }
  })
  it("hôtels : ancres uniques, valides, non vides", () => {
    const anchors = HOTEL_PROMOS.map((h) => hotelAnchor(h.name))
    expect(new Set(anchors).size, "deux hôtels donneraient la même ancre").toBe(HOTEL_PROMOS.length)
    for (const a of anchors) { expect(a).toMatch(VALID); expect(a.length).toBeGreaterThan("hotel-".length) }
  })
  it("slugify : stable, sans accent ni espace ni caractère spécial", () => {
    expect(hotelAnchor("Hôtel Été & Spa !")).toBe("hotel-hotel-ete-spa")
    expect(slugify("  --Café  Crème--  ")).toBe("cafe-creme")
    expect(slugify("")).toBe("")
    expect(voyageAnchor("istanbul 2026-11-14")).toBe("voyage-istanbul-2026-11-14")
  })
})

describe("non-régression : /omra et la redirection existante", () => {
  it("/omra ne redirige pas : ses paramètres de campagne restent dans l'adresse (capturés ensuite côté navigateur)", () => {
    const src = readFileSync(new URL("../app/omra/page.tsx", import.meta.url), "utf8")
    expect(src).not.toMatch(/\bredirect\(/)
    expect(src).not.toMatch(/\bnotFound\(/)
  })
  it("le secours n'a pas d'effet sur /omra ni sur les pages existantes", () => {
    for (const p of ["/omra", "/voyages-organises", "/summer-vibes", "/"]) expect(fallbackTarget(p, { utm_source: "a" })).toBeNull()
  })
})
