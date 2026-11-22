// Compteur de visites anonyme (sans cookie) et bandeau de consentement compact. Aucun réseau, aucune base.
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { cleanVisitUrl } from "@/lib/visit-counter"

const ROOT = new URL("..", import.meta.url).pathname
const src = (f: string) => readFileSync(ROOT + f, "utf8")

describe("compteur de visites : adresse nettoyée", () => {
  it("garde le chemin et les cinq paramètres UTM, rien d'autre", () => {
    const u = cleanVisitUrl("https://landingpage-easy2book.vercel.app/p/omra-ramadan-complet?utm_source=facebook&utm_medium=paid&utm_campaign=omra-ramadan-2027-fb&utm_term=ens&utm_content=video&fbclid=SECRET&ttclid=X&ref=E2B-ABC123&campaign_id=1&adset_id=2&ad_id=3&eventId=e")!
    expect(u).toBe("https://landingpage-easy2book.vercel.app/p/omra-ramadan-complet?utm_source=facebook&utm_medium=paid&utm_campaign=omra-ramadan-2027-fb&utm_term=ens&utm_content=video")
    for (const bad of ["fbclid", "ttclid", "ref=", "E2B-", "campaign_id", "adset_id", "ad_id", "eventId", "SECRET"]) expect(u).not.toContain(bad)
  })
  it("une page sans paramètre reste sans paramètre ; une adresse relative est acceptée", () => {
    expect(cleanVisitUrl("https://x.tn/p/evisa")).toBe("https://x.tn/p/evisa")
    expect(cleanVisitUrl("/omra?fbclid=1")).toBe("/omra")
  })
  it("l'espace équipe, l'API et les pages des entreprises clientes ne sont jamais comptés ; /omra l'est", () => {
    for (const p of ["/admin", "/admin/leads/123", "/api/leads", "/o/bob", "/o/bob/p/page", "/o"]) expect(cleanVisitUrl(`https://x.tn${p}`)).toBeNull()
    for (const p of ["/omra", "/omra-2027", "/p/evisa", "/c/omra-2027", "/voyages-organises", "/"]) expect(cleanVisitUrl(`https://x.tn${p}`)).not.toBeNull()
  })
  it("valeur de campagne bornée ; adresse illisible refusée sans erreur", () => {
    expect(cleanVisitUrl("https://x.tn/p/a?utm_campaign=" + "x".repeat(500))!.length).toBeLessThan(220)
    expect(cleanVisitUrl("http://[::bad")).toBeNull()
  })
})

describe("compteur de visites : branchement", () => {
  it("monté une seule fois dans la mise en page, avec nettoyage avant envoi, et expliqué dans la politique de confidentialité", () => {
    expect(src("app/layout.tsx")).toMatch(/<VisitCounter \/>/)
    const c = src("app/components/VisitCounter.tsx")
    expect(c).toMatch(/beforeSend/); expect(c).toMatch(/cleanVisitUrl/)
    expect(src("app/confidentialite/page.tsx")).toMatch(/sans cookie ni identifiant publicitaire/)
  })
  it("indépendant du consentement : aucun pixel publicitaire n'est touché par le compteur", () => {
    expect(src("app/components/VisitCounter.tsx")).not.toMatch(/fbq|ttq|getConsent|facebook|tiktok/i)
    expect(src("app/components/TrackingConsent.tsx")).toMatch(/consent === "granted" && pixels/)
  })
})

describe("bandeau de consentement compact sur mobile", () => {
  it("publie sa hauteur dans --consent-h et la retire à la réponse", () => {
    const t = src("app/components/TrackingConsent.tsx")
    expect(t).toMatch(/--consent-h/); expect(t).toMatch(/removeProperty\("--consent-h"\)/); expect(t).toMatch(/data-testid="consent-banner"/)
  })
  it("les barres d'appel à l'action fixes de /omra et des pages /p se placent au-dessus du bandeau ; les pages /c restent identiques (règle du propriétaire)", () => {
    for (const f of ["app/omra/OmraView.tsx", "app/p/[slug]/LandingView.tsx"]) expect(src(f)).toMatch(/bottom: "var\(--consent-h, 0px\)"/)
    expect(src("app/c/[slug]/CategoryView.tsx")).not.toMatch(/--consent-h/)
  })
})
