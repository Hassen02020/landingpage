import { beforeAll, describe, expect, it } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

let Section: typeof import("@/app/omra/ReviewsSection").ReviewsSection
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  Section = (await import("@/app/omra/ReviewsSection")).ReviewsSection
})

describe("section « avis des visiteurs » (/omra)", () => {
  const html = () => renderToStaticMarkup(createElement(Section, { page: "omra" }))
  it("avant tout chargement : aucune moyenne, aucune étoile chiffrée, aucun avis inventé ; formulaire complet", () => {
    const h = html()
    expect(h).toContain('data-testid="reviews"')
    expect(h).not.toContain('data-testid="reviews-average"')
    expect(h).not.toContain('data-testid="reviews-list"')
    expect(h).not.toMatch(/\d(\.\d)? \/ 5/)
    for (const champ of ['name="rating"', 'id="avis-nom"', 'id="avis-com"', 'type="checkbox"', 'type="submit"']) expect(h, champ).toContain(champ)
    expect((h.match(/name="rating"/g) ?? []).length).toBe(5)
  })
  it("le formulaire est en arabe, avec une note obligatoire, un accord de publication et un champ piège invisible", () => {
    const h = html()
    expect(h).toContain("شاركنا رأيك")
    expect(h).toContain("أوافق على نشر اسمي الأول وتعليقي")
    expect(h).toContain('aria-hidden="true" class="absolute -left-[9999px]')
    expect(h).toContain('tabindex="-1"')
  })
  it("la page Omra intègre la section ; aucun balisage de note pour Google (aggregateRating) n'existe nulle part", () => {
    expect(readFileSync(new URL("../app/omra/OmraView.tsx", import.meta.url), "utf8")).toContain('<ReviewsSection page="omra" />')
    for (const f of ["../app/omra/page.tsx", "../app/omra/OmraView.tsx", "../app/omra/ReviewsSection.tsx", "../app/api/reviews/route.ts"]) {
      expect(readFileSync(new URL(f, import.meta.url), "utf8"), f).not.toMatch(/aggregateRating|ratingValue/)
    }
  })
})
