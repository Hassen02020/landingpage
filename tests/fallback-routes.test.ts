// Comportement des routes /c/[slug] et /o/[slug] (dépendances simulées) et rendu de la page 404 globale.
// Un test unitaire ne prouve PAS le comportement sur Netlify / Vercel : voir le parcours e2e tests/e2e/fallback.e2e.mjs.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { renderToStaticMarkup } from "react-dom/server"

class Redirect extends Error { constructor(public to: string) { super(`REDIRECT:${to}`) } }
class NotFound extends Error { constructor() { super("NOTFOUND") } }
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirect(to) }, notFound: () => { throw new NotFound() }, usePathname: () => "/", useSearchParams: () => new URLSearchParams() }))

let configured = true
let category: { status: string; data?: unknown } = { status: "not_found" }
let org: { status: string; org?: unknown } = { status: "not_found" }
vi.mock("@/lib/server/db", () => ({ dbConfigured: () => configured, withPublicOrg: (fn: () => unknown) => fn(), runWithOrg: (_id: string, fn: () => unknown) => fn() }))
vi.mock("@/lib/server/catalog", () => ({ lookupPublicCategory: async () => category, publicCategory: async () => null }))
vi.mock("@/lib/server/org-public", () => ({ lookupPublicOrg: async () => org, loadPublicOrg: async () => null, loadFormConfig: async () => ({}), publicOfferNames: async () => [] }))
vi.mock("@/app/c/[slug]/CategoryView", () => ({ CategoryView: () => null }))
vi.mock("@/app/o/[slug]/OrgLeadForm", () => ({ OrgLeadForm: () => null }))

let CategoryPage: typeof import("@/app/c/[slug]/page").default
let OrgPage: typeof import("@/app/o/[slug]/page").default
let NotFoundPage: typeof import("@/app/not-found").default
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  CategoryPage = (await import("@/app/c/[slug]/page")).default
  OrgPage = (await import("@/app/o/[slug]/page")).default
  NotFoundPage = (await import("@/app/not-found")).default
})
beforeEach(() => { configured = true; category = { status: "not_found" }; org = { status: "not_found" } })

const outcome = async (p: Promise<unknown>) => p.then(() => "RENDERED", (e) => (e instanceof Redirect ? `REDIRECT:${e.to}` : e instanceof NotFound ? "NOTFOUND" : `ERROR:${(e as Error).message}`))
const Q = { utm_source: "facebook", utm_campaign: "x" }

describe("/c/[slug]", () => {
  it("slug inconnu → redirection vers le secours AVEC les UTM", async () => {
    expect(await outcome(CategoryPage({ params: { slug: "slug-inconnu" }, searchParams: Q }))).toBe("REDIRECT:/voyages-organises?utm_source=facebook&utm_campaign=x")
  })
  it("slug inconnu sans paramètre → secours sans « ? »", async () => {
    expect(await outcome(CategoryPage({ params: { slug: "slug-inconnu" }, searchParams: {} }))).toBe("REDIRECT:/voyages-organises")
  })
  it("panne de base (erreur) → 404 conservé, JAMAIS de redirection qui masquerait l'incident", async () => {
    category = { status: "error" }
    expect(await outcome(CategoryPage({ params: { slug: "omra-x" }, searchParams: Q }))).toBe("NOTFOUND")
  })
  it("base non configurée → 404 conservé, pas de secours", async () => {
    configured = false
    expect(await outcome(CategoryPage({ params: { slug: "x" }, searchParams: Q }))).toBe("NOTFOUND")
  })
  it("catégorie trouvée → affichée, aucune redirection", async () => {
    category = { status: "found", data: { category: { slug: "ok" }, offers: [] } }
    expect(await outcome(CategoryPage({ params: { slug: "ok" }, searchParams: Q }))).toBe("RENDERED")
  })
  it("NON-RÉGRESSION : /c/omra-2027 redirige toujours vers /omra en conservant les paramètres", async () => {
    expect(await outcome(CategoryPage({ params: { slug: "omra-2027" }, searchParams: { utm_source: "facebook", utm_campaign: "x", tag: ["a", "b"] } }))).toBe("REDIRECT:/omra?utm_source=facebook&utm_campaign=x&tag=a&tag=b")
    expect(await outcome(CategoryPage({ params: { slug: "omra-2027" }, searchParams: {} }))).toBe("REDIRECT:/omra")
  })
})

describe("/o/[slug]", () => {
  it("entreprise inconnue ou suspendue → secours (accueil) AVEC les UTM", async () => {
    expect(await outcome(OrgPage({ params: { slug: "inconnue" }, searchParams: Q }))).toBe("REDIRECT:/?utm_source=facebook&utm_campaign=x")
  })
  it("panne de base → 404 conservé, pas de secours", async () => {
    org = { status: "error" }
    expect(await outcome(OrgPage({ params: { slug: "acme" }, searchParams: Q }))).toBe("NOTFOUND")
  })
  it("NON-RÉGRESSION : /o/easy2book redirige toujours vers l'accueil", async () => {
    org = { status: "found", org: { id: "1", slug: "easy2book", name: "Easy2Book" } }
    expect(await outcome(OrgPage({ params: { slug: "easy2book" }, searchParams: {} }))).toBe("REDIRECT:/")
  })
  it("entreprise active → page affichée", async () => {
    org = { status: "found", org: { id: "1", slug: "acme", name: "Acme" } }
    expect(await outcome(OrgPage({ params: { slug: "acme" }, searchParams: {} }))).toBe("RENDERED")
  })
})

describe("page 404 globale (rendu)", () => {
  it("titre clair en français, retour accueil et WhatsApp vers le numéro du site", async () => {
    const { WHATSAPP_NUMBER } = await import("@/lib/config")
    const html = renderToStaticMarkup(NotFoundPage() as never)
    expect(html).toContain("Cette page n&#x27;existe pas ou plus")
    expect(html).toContain("Retour à l&#x27;accueil")
    expect(html).toContain('href="/"')
    expect(html).toContain(`https://wa.me/${WHATSAPP_NUMBER}?text=`)
    expect(html).toContain("noopener")
  })
})
