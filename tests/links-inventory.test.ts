// CHANTIER 2 — PROTECTION DES LIENS EXISTANTS. Ces tests FIGENT ce qui est déjà diffusé : tant qu'ils passent, aucune évolution
// (créateur de pages, bloc « Lien publicitaire », Google Ads…) n'a changé un lien publicitaire existant.
// Si l'un d'eux échoue, c'est qu'un lien déjà en circulation a changé : à valider explicitement avant de modifier la valeur attendue.
import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { FIXED_DESTINATIONS, LINK_SOURCES, bioLinks, buildLink } from "../lib/links"
import { detectChannel } from "../lib/channel"
import { isConventionalCampaign, suggestCampaignName } from "../lib/campaign-name"

const BASE = "https://landingpage-easy2book.vercel.app"
const DEST = [...FIXED_DESTINATIONS, { path: "/c/omra-ramadan-2027", label: "catégorie" }]
const ROOT = new URL("..", import.meta.url).pathname

// valeurs relevées sur main (60eb82e) avant le chantier : campagne « Omra Ramadan 2027 », contenu « Vidéo Groupe »
const GOLDEN: [source: string, medium: string, mode: "static" | "dynamic", url: string][] = [
  ["facebook", "paid", "static", `${BASE}/omra?utm_source=facebook&utm_medium=paid&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["facebook", "paid", "dynamic", `${BASE}/c/omra-ramadan-2027?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`],
  ["facebook", "organic", "static", `${BASE}/omra?utm_source=facebook&utm_medium=organic_social&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["facebook", "story", "static", `${BASE}/omra?utm_source=facebook&utm_medium=story&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["instagram", "paid", "static", `${BASE}/omra?utm_source=instagram&utm_medium=paid&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["instagram", "paid", "dynamic", `${BASE}/c/omra-ramadan-2027?utm_source=instagram&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`],
  ["instagram", "organic", "static", `${BASE}/omra?utm_source=instagram&utm_medium=organic_social&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["instagram", "bio", "static", `${BASE}/omra?utm_source=instagram&utm_medium=bio&utm_campaign=bio`],
  ["instagram", "story", "static", `${BASE}/omra?utm_source=instagram&utm_medium=story&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["tiktok", "paid", "static", `${BASE}/omra?utm_source=tiktok&utm_medium=paid&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["tiktok", "paid", "dynamic", `${BASE}/c/omra-ramadan-2027?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_term=__AID_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__`],
  ["tiktok", "organic", "static", `${BASE}/omra?utm_source=tiktok&utm_medium=organic_social&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["tiktok", "bio", "static", `${BASE}/omra?utm_source=tiktok&utm_medium=bio&utm_campaign=bio`],
  ["whatsapp", "message", "static", `${BASE}/omra?utm_source=whatsapp&utm_medium=message&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
  ["whatsapp", "status", "static", `${BASE}/omra?utm_source=whatsapp&utm_medium=status&utm_campaign=omra-ramadan-2027&utm_content=video-groupe`],
]

describe("liens publicitaires diffusés : générateur inchangé", () => {
  it.each(GOLDEN)("%s / %s (%s) produit EXACTEMENT le lien historique", (source, medium, mode, expected) => {
    const r =
      mode === "dynamic"
        ? buildLink({ path: "/c/omra-ramadan-2027", source, medium, dynamic: true }, DEST, BASE)
        : buildLink({ path: "/omra", source, medium, campaign: medium === "bio" ? "" : "Omra Ramadan 2027", content: medium === "bio" ? "" : "Vidéo Groupe" }, DEST, BASE)
    expect(r.ok && r.url).toBe(expected)
  })

  it("aucun réseau / support historique n'a disparu (de nouveaux peuvent s'ajouter)", () => {
    const have = new Set(LINK_SOURCES.flatMap((s) => s.mediums.map((m) => `${s.id}|${m.id}`)))
    for (const [s, m] of GOLDEN) expect(have.has(`${s}|${m}`), `${s}|${m}`).toBe(true)
  })

  it("liens de bio : Instagram, TikTok, Facebook inchangés", () => {
    expect(bioLinks(BASE)).toEqual([
      { network: "Instagram", url: `${BASE}/?utm_source=instagram&utm_medium=bio&utm_campaign=bio` },
      { network: "TikTok", url: `${BASE}/?utm_source=tiktok&utm_medium=bio&utm_campaign=bio` },
      { network: "Facebook", url: `${BASE}/?utm_source=facebook&utm_medium=organic_social&utm_campaign=bio` },
    ])
  })

  it("pages fixes proposées au générateur : toujours /, /omra, /voyages-organises, /summer-vibes", () => {
    expect(FIXED_DESTINATIONS.map((d) => d.path)).toEqual(["/", "/omra", "/voyages-organises", "/summer-vibes"])
  })
})

describe("anciens formats de liens (README) toujours reconnus", () => {
  const q = (s: string) => new URLSearchParams(s)
  it("utm_source historiques : instagram_bio, tiktok_bio, whatsapp, facebook, instagram", () => {
    expect(detectChannel(q("utm_source=instagram_bio&utm_campaign=x"), "")).toBe("meta")
    expect(detectChannel(q("utm_source=tiktok_bio&utm_campaign=x"), "")).toBe("tiktok")
    expect(detectChannel(q("utm_source=whatsapp&utm_campaign=x"), "")).toBe("whatsapp")
    expect(detectChannel(q("utm_source=facebook&utm_medium=paid"), "")).toBe("meta")
    expect(detectChannel(q("utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__"), "")).toBe("tiktok")
  })
  it("identifiants publicitaires : fbclid, ttclid, gclid prioritaires", () => {
    expect(detectChannel(q("fbclid=a"), "")).toBe("meta")
    expect(detectChannel(q("ttclid=a"), "")).toBe("tiktok")
    expect(detectChannel(q("gclid=a"), "")).toBe("google")
  })
})

// ---- inventaire des routes publiques : toute route AJOUTÉE ou RETIRÉE doit être décidée explicitement
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(relative(ROOT, p))
  }
  return out
}
describe("inventaire des routes publiques", () => {
  const files = walk(join(ROOT, "app"))
  const pages = files.filter((f) => /\/page\.tsx$|^app\/page\.tsx$/.test(f) && !f.startsWith("app/admin/")).sort()
  it("pages publiques existantes (aucune ne doit disparaître : des publicités y mènent)", () => {
    for (const p of ["app/page.tsx", "app/omra/page.tsx", "app/voyages-organises/page.tsx", "app/summer-vibes/page.tsx", "app/c/[slug]/page.tsx", "app/o/[slug]/page.tsx", "app/confidentialite/page.tsx", "app/mentions-legales/page.tsx"]) {
      expect(pages, p).toContain(p)
    }
  })
  it("redirections historiques : /c/omra-2027 → /omra (page) et /omra-2027 → /omra (config, 307, sans joker)", async () => {
    const cpage = readFileSync(join(ROOT, "app/c/[slug]/page.tsx"), "utf8")
    expect(cpage).toMatch(/params\.slug === "omra-2027"/)
    expect(cpage).toMatch(/redirect\(`\/omra/)
    const cfg = (await import("../next.config.mjs")).default as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }
    expect(await cfg.redirects()).toEqual([{ source: "/omra-2027", destination: "/omra", permanent: false }])
  })
  it("routes d'API publiques d'attribution et de collecte toujours présentes", () => {
    for (const r of ["app/api/leads/route.ts", "app/api/o/[slug]/leads/route.ts", "app/api/track/route.ts"]) expect(files, r).toContain(r)
  })
})

describe("nommage des campagnes : avertir sans casser les anciens liens", () => {
  it("un nom avec tiret bas produit TOUJOURS le même lien (aucune correction silencieuse)", () => {
    const r = buildLink({ path: "/omra", source: "facebook", medium: "paid", campaign: "omra_ramadan_2027" }, DEST, BASE)
    expect(r.ok && r.url).toBe(`${BASE}/omra?utm_source=facebook&utm_medium=paid&utm_campaign=omra_ramadan_2027`)
  })
  it("le format est signalé hors convention et une proposition conforme existe (jamais appliquée d'office)", () => {
    for (const bad of ["omra_ramadan_2027", "Omra 2027", "omra--2027", "été"]) expect(isConventionalCampaign(bad), bad).toBe(false)
    expect(suggestCampaignName("omra_ramadan_2027")).toBe("omra-ramadan-2027")
    expect(isConventionalCampaign("omra-ramadan-2027")).toBe(true)
  })
  it("l'écran du générateur affiche l'avertissement sans modifier le lien", () => {
    const src = readFileSync(join(ROOT, "app/admin/(crm)/liens/LinkBuilder.tsx"), "utf8")
    expect(src).toMatch(/data-testid="naming-warning"/)
    expect(src).toMatch(/isConventionalCampaign\(usedCampaign/)
    expect(src).not.toMatch(/setCampaign\(suggestCampaignName/) // jamais de correction automatique
  })
})
