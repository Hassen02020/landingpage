// /admin/liens selon l'ENTREPRISE connectée : Easy2Book voit ses pages et son catalogue ; une autre entreprise ne voit QUE sa page de collecte.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { renderToStaticMarkup } from "react-dom/server"

let platform = true
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("@/lib/server/db", () => ({ dbConfigured: () => true, isPlatformOrg: async () => platform }))
vi.mock("@/lib/server/auth", () => ({ currentStaff: async () => ({ userId: "u", orgRole: "admin", organizationSlug: "bob-sarl", organizationName: "Bob SARL" }) }))
vi.mock("@/lib/server/catalog", () => ({ publicCategories: async () => [{ slug: "e2b-seulement", name: "Page Easy2Book Seulement" }, { slug: "omra-2027", name: "Omra" }] }))
let LinksPage: typeof import("@/app/admin/(crm)/liens/page").default
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LinksPage = (await import("@/app/admin/(crm)/liens/page")).default
})
beforeEach(() => { platform = true })
const options = (html: string) => Array.from(html.matchAll(/<option value="([^"]*)"/g)).map((m) => m[1])

describe("générateur de liens selon l'entreprise", () => {
  it("Easy2Book : pages fixes + catalogue + liens de bio (inchangé)", async () => {
    const html = renderToStaticMarkup((await LinksPage()) as never)
    expect(options(html)).toEqual(expect.arrayContaining(["/", "/omra", "/voyages-organises", "/summer-vibes", "/c/e2b-seulement"]))
    expect(html).toContain("Liens de bio des comptes officiels")
    expect(html).not.toContain("company-links-note")
  })
  it("autre entreprise : UNIQUEMENT /o/<son identifiant> ; aucune page ni catalogue d'Easy2Book ; pas de liens de bio d'Easy2Book", async () => {
    platform = false
    const html = renderToStaticMarkup((await LinksPage()) as never)
    const paths = options(html).filter((v) => v.startsWith("/"))
    expect(paths).toEqual(["/o/bob-sarl"])
    for (const forbidden of ["/omra", "/voyages-organises", "/summer-vibes", "/c/", "e2b-seulement", "Page Easy2Book Seulement"]) expect(html, forbidden).not.toContain(forbidden === "/c/" ? 'value="/c/' : forbidden)
    expect(html).not.toContain("Liens de bio des comptes officiels")
    expect(html).not.toContain("facebook.com/Easy2Bookplateforme")
    expect(html).toContain("company-links-note")
  })
})
