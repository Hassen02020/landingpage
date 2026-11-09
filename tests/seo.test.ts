import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import sitemap from "../app/sitemap"
import robots from "../app/robots"

describe("SEO technique", () => {
  it("le sitemap liste les pages publiques et pas l'admin, l'API ni les pages d'entreprise", () => {
    const urls = sitemap().map((e) => e.url)
    for (const p of ["/voyages-organises", "/omra", "/summer-vibes", "/confidentialite"]) expect(urls.some((u) => u.endsWith(p))).toBe(true)
    expect(urls.some((u) => /\/(admin|api|o|c)(\/|$)/.test(u))).toBe(false)
  })
  it("robots.txt interdit l'admin et l'API et déclare le sitemap", () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api/"]))
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/)
  })
  it("aucune balise fb:page_id invalide ni note moyenne inventée dans les métadonnées", () => {
    for (const f of ["app/layout.tsx", "app/omra/layout.tsx", "app/summer-vibes/layout.tsx", "app/voyages-organises/layout.tsx"]) {
      const s = readFileSync(f, "utf8")
      expect(s).not.toMatch(/fb:page_id/)
      expect(s).not.toMatch(/aggregateRating/)
      expect(s).toMatch(/canonical/)
    }
  })
})

describe("Politique de confidentialité", () => {
  const page = readFileSync("app/confidentialite/page.tsx", "utf8")
  const purge = readFileSync("supabase/migrations/0014_form_configs.sql", "utf8")
  it("les durées annoncées correspondent à la purge réelle", () => {
    for (const [txt, sql] of [["24 mois", "24 months"], ["36 mois", "36 months"], ["90 jours", "90 days"], ["13 mois", "13 months"]]) {
      expect(page).toContain(txt)
      expect(purge).toContain(sql)
    }
  })
})
