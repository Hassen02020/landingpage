import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { attributionFromUrl, touchFromUrl } from "../lib/url-attribution"
import { flattenAttribution } from "../lib/server/attribution"
import { companyDestinations, FIXED_DESTINATIONS } from "../lib/links"

describe("attribution des pages d'entreprise (/o) lue dans l'adresse", () => {
  const search = "?utm_source=facebook&utm_medium=paid&utm_campaign=camp-bob&utm_content=visuel-2&utm_term=femmes&campaign_id=C1&adset_id=S1&ad_id=A1"
  it("campagne, source, support, contenu, groupe, annonce et page d'arrivée conservés ; canal reconnu", () => {
    const t = touchFromUrl(search, "/o/bob-sarl")
    expect(t).toMatchObject({ channel: "meta", landing_page: "/o/bob-sarl", utm_source: "facebook", utm_medium: "paid", utm_campaign: "camp-bob", utm_content: "visuel-2", utm_term: "femmes", campaign_id: "C1", adset_id: "S1", ad_id: "A1" })
  })
  it("les identifiants de CLIC (fbclid, ttclid, gclid) ne sont JAMAIS transmis (pas de consentement aux traceurs sur ces pages) mais aident à reconnaître le canal", () => {
    const t = touchFromUrl("?fbclid=IwAR1&ttclid=T1&gclid=G1&utm_campaign=x", "/o/bob-sarl")
    expect(JSON.stringify(t)).not.toMatch(/fbclid|ttclid|gclid|IwAR1|T1|G1/)
    expect(t.channel).toBe("meta") // fbclid prioritaire pour reconnaître le canal
    expect(touchFromUrl("?ttclid=T1", "/o/x").channel).toBe("tiktok")
    expect(touchFromUrl("?gclid=G1", "/o/x").channel).toBe("google")
  })
  it("sans paramètre : canal direct (ou référent), aucune campagne inventée ; valeurs tronquées à 255", () => {
    const t = touchFromUrl("", "/o/bob-sarl", "")
    expect(t.channel).toBe("direct"); expect(t.utm_campaign).toBeUndefined()
    expect(touchFromUrl(`?utm_campaign=${"a".repeat(400)}`, "/o/x").utm_campaign).toHaveLength(255)
    expect(touchFromUrl("", "/o/x", "https://www.facebook.com/").channel).toBe("meta")
  })
  it("le serveur retrouve exactement ces valeurs dans le prospect (même lecture que les pages de la plateforme)", () => {
    const a = attributionFromUrl(`https://site.test/o/bob-sarl${search}`, "/o/bob-sarl", search)
    const flat = flattenAttribution(a)
    expect(flat).toMatchObject({ channel: "meta", utm_source: "facebook", utm_medium: "paid", utm_campaign: "camp-bob", utm_content: "visuel-2", ad_id: "A1", adset_id: "S1", campaign_id: "C1", landing_page: "/o/bob-sarl" })
    expect(flat.fbclid ?? null).toBeNull()
    expect(a.page_url).toContain("utm_campaign=camp-bob")
  })
  it("le formulaire /o envoie l'attribution lue dans l'adresse (garde contre un retour en arrière)", () => {
    const src = readFileSync(new URL("../app/o/[slug]/OrgLeadForm.tsx", import.meta.url), "utf8")
    expect(src).toMatch(/attributionFromUrl\(window\.location\.href, window\.location\.pathname, window\.location\.search/)
    expect(src).not.toMatch(/fbclid|ttclid|gclid/)
  })
})

describe("destinations d'une entreprise cliente", () => {
  it("uniquement SA page de collecte /o/<identifiant> : jamais une page fixe ni le catalogue d'Easy2Book", () => {
    const d = companyDestinations("bob-sarl", "Bob SARL")
    expect(d).toEqual([{ path: "/o/bob-sarl", label: "Page de collecte de Bob SARL" }])
    for (const x of d) { expect(FIXED_DESTINATIONS.map((f) => f.path)).not.toContain(x.path); expect(x.path.startsWith("/c/")).toBe(false) }
  })
  it("identifiant absent, invalide ou « easy2book » : aucune destination (jamais de repli vers la plateforme)", () => {
    for (const bad of [null, undefined, "", "easy2book", "A B", "../x", "x", "-x", "x/y"]) expect(companyDestinations(bad as string), String(bad)).toEqual([])
  })
})
