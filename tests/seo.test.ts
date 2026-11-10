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

describe("Mentions légales", () => {
  const page = readFileSync("app/mentions-legales/page.tsx", "utf8")
  it("la page affiche toutes les mentions exigées à partir de la source unique", async () => {
    const { LEGAL } = await import("../lib/legal")
    expect(LEGAL.companyName).toBe("Easy2Book Tarhouni Hassen")
    expect(LEGAL.registrationId).toBe("1399210/02/Z")
    expect(LEGAL.address).toBe("Avenue 28 Mars, Siliana, Tunisie")
    expect(LEGAL.publicationDirector).toBe("Tarhouni Hassen")
    for (const k of ["LEGAL.companyName", "LEGAL.registrationId", "LEGAL.address", "LEGAL.publicationDirector", "LEGAL.host"]) expect(page).toContain(k)
    expect(page).toMatch(/Directeur de la publication/)
    expect(page).toMatch(/Hébergement/)
  })
  it("la page est dans le sitemap, a un canonical, et le pied de page la relie", () => {
    expect(sitemap().some((e) => e.url.endsWith("/mentions-legales"))).toBe(true)
    expect(page).toMatch(/canonical/)
    expect(readFileSync("app/components/SiteFooter.tsx", "utf8")).toContain("/mentions-legales")
  })
  it("la politique de confidentialité cite l'éditeur légal", () => {
    expect(readFileSync("app/confidentialite/page.tsx", "utf8")).toContain("LEGAL.companyName")
  })
})
