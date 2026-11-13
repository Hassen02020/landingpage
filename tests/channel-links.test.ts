import { describe, expect, it } from "vitest"
import { detectChannel, inAppSource } from "@/lib/channel"
import { LINK_SOURCES, bioLinks, buildLink, destinationsFor, slugParam, FIXED_DESTINATIONS } from "@/lib/links"
import { flattenAttribution } from "@/lib/server/attribution"

const q = (s: string) => new URLSearchParams(s)
const BASE = "https://landingpage-easy2book.vercel.app"

describe("détection du canal d'acquisition", () => {
  it("reconnaît les identifiants publicitaires avant tout autre signal", () => {
    expect(detectChannel(q("fbclid=abc"), "")).toBe("meta")
    expect(detectChannel(q("ttclid=abc"), "")).toBe("tiktok")
    expect(detectChannel(q("gclid=abc"), "")).toBe("google")
    expect(detectChannel(q("fbclid=abc&utm_source=newsletter"), "")).toBe("meta")
  })

  it("utm_source : MOTS ENTIERS uniquement (régression : « digital » n'est pas Meta, « wave » n'est pas WhatsApp)", () => {
    for (const s of ["facebook", "Facebook_Ads", "fb", "instagram", "ig", "instagram_story", "meta", "messenger"]) expect(detectChannel(q(`utm_source=${s}`), "")).toBe("meta")
    for (const s of ["digital", "digital_bio", "big-sale", "bigcommerce", "figma", "agency"]) expect(detectChannel(q(`utm_source=${s}`), "")).toBe("referral")
    expect(detectChannel(q("utm_source=tiktok"), "")).toBe("tiktok")
    expect(detectChannel(q("utm_source=whatsapp"), "")).toBe("whatsapp")
    expect(detectChannel(q("utm_source=wa"), "")).toBe("whatsapp")
    for (const s of ["wave", "away", "hawaii", "newsletter"]) expect(detectChannel(q(`utm_source=${s}`), "")).toBe("referral")
    expect(detectChannel(q("utm_source=google"), "")).toBe("google")
  })

  it("référent : applications Facebook / Instagram / TikTok / WhatsApp, moteurs de recherche, site lui-même", () => {
    for (const r of ["https://l.facebook.com/l.php?u=x", "https://lm.facebook.com/", "https://l.instagram.com/?u=x", "https://m.facebook.com/", "https://www.instagram.com/"]) expect(detectChannel(q(""), r)).toBe("meta")
    expect(detectChannel(q(""), "https://www.tiktok.com/@easy2book")).toBe("tiktok")
    expect(detectChannel(q(""), "https://vm.tiktok.com/abc")).toBe("tiktok")
    expect(detectChannel(q(""), "https://wa.me/21698140514")).toBe("whatsapp")
    expect(detectChannel(q(""), "https://www.google.com/")).toBe("organic")
    expect(detectChannel(q(""), "https://www.bing.com/")).toBe("organic")
    expect(detectChannel(q(""), "https://linktr.ee/easy2book")).toBe("referral")
    expect(detectChannel(q(""), "https://landingpage-easy2book.vercel.app/", { host: "landingpage-easy2book.vercel.app" })).toBe("direct")
    expect(detectChannel(q(""), "https://notfacebook.com.evil.tn/")).toBe("referral") // pas de faux ami (le domaine doit VRAIMENT être facebook.com)
    expect(detectChannel(q(""), "pas une url")).toBe("direct")
  })

  it("navigateur intégré (référent retiré par l'application) : repli sur le User-Agent, sans inventer d'UTM", () => {
    const ig = "Mozilla/5.0 (iPhone) AppleWebKit Mobile Instagram 300.0.0.0"
    const fb = "Mozilla/5.0 (Linux; Android 13) [FB_IAB/FB4A;FBAV/450.0]"
    const tt = "Mozilla/5.0 (Linux; Android 13) musical_ly_32.0 BytedanceWebview"
    expect(detectChannel(q(""), "", { userAgent: ig })).toBe("meta")
    expect(detectChannel(q(""), "", { userAgent: fb })).toBe("meta")
    expect(detectChannel(q(""), "", { userAgent: tt })).toBe("tiktok")
    expect(detectChannel(q(""), "", { userAgent: "Mozilla/5.0 Chrome/120" })).toBe("direct")
    // un paramètre explicite l'emporte sur le User-Agent
    expect(detectChannel(q("utm_source=newsletter"), "", { userAgent: ig })).toBe("referral")
    expect(inAppSource(undefined)).toBeNull()
  })
})

describe("générateur de liens de campagne", () => {
  const dest = destinationsFor([{ slug: "omra-2027", name: "Omra" }, { slug: "turquie-ete", name: "Turquie été 2027" }])

  it("produit un lien par réseau et support avec des UTM cohérents (source, medium, campaign, content)", () => {
    const r = buildLink({ path: "/omra", source: "instagram", medium: "organic", campaign: "Omra Ramadan 2027", content: "Vidéo Groupe" }, dest, BASE)
    expect(r).toMatchObject({ ok: true, url: `${BASE}/omra?utm_source=instagram&utm_medium=organic_social&utm_campaign=omra-ramadan-2027&utm_content=video-groupe` })
    expect(buildLink({ path: "/", source: "tiktok", medium: "bio" }, dest, BASE)).toMatchObject({ ok: true, url: `${BASE}/?utm_source=tiktok&utm_medium=bio&utm_campaign=bio` })
    expect(buildLink({ path: "/c/turquie-ete", source: "facebook", medium: "paid", campaign: "ete" }, dest, BASE)).toMatchObject({ ok: true, url: `${BASE}/c/turquie-ete?utm_source=facebook&utm_medium=paid&utm_campaign=ete` })
    expect(buildLink({ path: "/omra", source: "whatsapp", medium: "message", campaign: "diffusion-janvier" }, dest, BASE)).toMatchObject({ ok: true })
  })

  it("tout lien généré est reconnu par la détection de canal et conserve ses paramètres (aller-retour)", () => {
    const expected: Record<string, string> = { facebook: "meta", instagram: "meta", tiktok: "tiktok", whatsapp: "whatsapp", google: "google" }
    for (const s of LINK_SOURCES) {
      for (const m of s.mediums) {
        const r = buildLink({ path: "/omra", source: s.id, medium: m.id, campaign: "test-campagne", content: "visuel-1" }, dest, BASE)
        expect(r.ok).toBe(true)
        if (!r.ok) continue
        const u = new URL(r.url)
        expect(detectChannel(u.searchParams, "")).toBe(expected[s.id])
        expect(u.searchParams.get("utm_source")).toBe(s.utm_source)
        expect(u.searchParams.get("utm_medium")).toBe(m.utm_medium)
        // le serveur retrouve exactement ces valeurs dans le lead
        const flat = flattenAttribution({ last_touch: { channel: expected[s.id], ...Object.fromEntries(u.searchParams), landing_page: u.pathname } })
        expect(flat).toMatchObject({ channel: expected[s.id], utm_source: s.utm_source, utm_medium: m.utm_medium, utm_campaign: "test-campagne", utm_content: "visuel-1", landing_page: "/omra" })
      }
    }
  })

  it("destinations : pages fixes + catégories visibles ; omra-2027 n'a qu'une adresse (/omra) ; adresse inconnue refusée", () => {
    expect(dest.map((d) => d.path)).toEqual([...FIXED_DESTINATIONS.map((d) => d.path), "/c/turquie-ete"])
    expect(dest.some((d) => d.path === "/c/omra-2027")).toBe(false)
    const bad = buildLink({ path: "/page-qui-nexiste-pas", source: "tiktok", medium: "bio" }, dest, BASE)
    expect(bad).toMatchObject({ ok: false, errors: { path: expect.any(String) } })
    expect(buildLink({ path: "https://evil.tn/", source: "tiktok", medium: "bio" }, dest, BASE).ok).toBe(false)
  })

  it("refuse réseau / support inconnus, campagne vide (hors bio) et dynamique hors publicité payante", () => {
    expect(buildLink({ path: "/", source: "snapchat", medium: "paid", campaign: "x" }, dest).ok).toBe(false)
    expect(buildLink({ path: "/", source: "whatsapp", medium: "paid", campaign: "x" }, dest).ok).toBe(false)
    expect(buildLink({ path: "/", source: "facebook", medium: "paid", campaign: "  " }, dest)).toMatchObject({ ok: false, errors: { campaign: expect.any(String) } })
    expect(buildLink({ path: "/", source: "instagram", medium: "bio", dynamic: true }, dest)).toMatchObject({ ok: false, errors: { dynamic: expect.any(String) } })
  })

  it("publicité payante : paramètres dynamiques bruts (Meta et TikTok)", () => {
    const meta = buildLink({ path: "/omra", source: "facebook", medium: "paid", dynamic: true }, dest, BASE)
    expect(meta).toMatchObject({ ok: true, url: expect.stringContaining("utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}") })
    const tt = buildLink({ path: "/omra", source: "tiktok", medium: "paid", dynamic: true }, dest, BASE)
    expect(tt).toMatchObject({ ok: true, url: expect.stringContaining("utm_campaign=__CAMPAIGN_NAME__") })
    expect(tt.ok && tt.url).toContain("ad_id=__CID__")
  })

  it("noms normalisés : sans accent, sans espace, 64 caractères, pas d'injection", () => {
    expect(slugParam("Été 2027 — Turquie !")).toBe("ete-2027-turquie")
    expect(slugParam("<script>alert(1)</script>")).toBe("script-alert-1-script")
    expect(slugParam("a".repeat(200))).toHaveLength(64)
    const r = buildLink({ path: "/", source: "facebook", medium: "paid", campaign: "x&utm_source=evil#frag" }, dest, BASE)
    expect(r.ok && r.url).toBe(`${BASE}/?utm_source=facebook&utm_medium=paid&utm_campaign=x-utm_source-evil-frag`)
  })

  it("liens de bio recommandés : Instagram, TikTok, Facebook, tous valides", () => {
    const bios = bioLinks(BASE)
    expect(bios.map((b) => b.network)).toEqual(["Instagram", "TikTok", "Facebook"])
    expect(bios[0].url).toBe(`${BASE}/?utm_source=instagram&utm_medium=bio&utm_campaign=bio`)
    expect(bios[2].url).toContain("utm_medium=organic_social")
    for (const b of bios) expect(b.url.startsWith(BASE)).toBe(true)
  })
})
