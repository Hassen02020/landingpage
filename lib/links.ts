// Générateur de liens de campagne : mêmes règles partout, pour que chaque lead soit rattaché à sa source.
// Fonctions pures (testées). Aucune campagne n'est lancée : on produit seulement des adresses.
import { SITE_URL } from "./config"

export interface LinkSource {
  id: string
  label: string
  utm_source: string
  mediums: { id: string; label: string; utm_medium: string }[]
  /** Paramètres dynamiques de la plateforme (publicité payante) : noms de campagne / groupe / annonce remplis automatiquement. */
  dynamic?: string
}

const META_DYNAMIC = "utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}"
const TIKTOK_DYNAMIC = "utm_campaign=__CAMPAIGN_NAME__&utm_term=__AID_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__"

export const LINK_SOURCES: LinkSource[] = [
  {
    id: "facebook",
    label: "Facebook",
    utm_source: "facebook",
    dynamic: META_DYNAMIC,
    mediums: [
      { id: "paid", label: "Publicité payante", utm_medium: "paid" },
      { id: "organic", label: "Publication de la page", utm_medium: "organic_social" },
      { id: "story", label: "Story", utm_medium: "story" },
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    utm_source: "instagram",
    dynamic: META_DYNAMIC,
    mediums: [
      { id: "paid", label: "Publicité payante", utm_medium: "paid" },
      { id: "organic", label: "Publication / Reel", utm_medium: "organic_social" },
      { id: "bio", label: "Lien de la bio", utm_medium: "bio" },
      { id: "story", label: "Story", utm_medium: "story" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    utm_source: "tiktok",
    dynamic: TIKTOK_DYNAMIC,
    mediums: [
      { id: "paid", label: "Publicité payante", utm_medium: "paid" },
      { id: "organic", label: "Vidéo organique", utm_medium: "organic_social" },
      { id: "bio", label: "Lien de la bio", utm_medium: "bio" },
    ],
  },
  {
    // Google Ads STATIQUE : nom de campagne obligatoire, aucun paramètre dynamique. Le balisage automatique de Google Ads ajoute le gclid tout seul.
    // (La conservation du gclid sur le prospect nécessite une migration : chantier distinct, non inclus.)
    id: "google",
    label: "Google Ads",
    utm_source: "google",
    mediums: [{ id: "cpc", label: "Publicité payante (Google Ads)", utm_medium: "cpc" }],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    utm_source: "whatsapp",
    mediums: [
      { id: "message", label: "Message / diffusion", utm_medium: "message" },
      { id: "status", label: "Statut WhatsApp", utm_medium: "status" },
    ],
  },
]

export interface Destination {
  path: string
  label: string
}

/** Pages publiques fixes ; les catégories visibles du catalogue s'ajoutent (/c/adresse). */
export const FIXED_DESTINATIONS: Destination[] = [
  { path: "/", label: "Accueil (toutes les offres)" },
  { path: "/omra", label: "Omra" },
  { path: "/voyages-organises", label: "Voyages organisés" },
  { path: "/summer-vibes", label: "Promos hôtels" },
]

export function destinationsFor(categories: { slug: string; name: string }[]): Destination[] {
  // omra-2027 est servie par /omra (une seule adresse officielle par contenu)
  const extra = categories.filter((c) => c.slug !== "omra-2027").map((c) => ({ path: `/c/${c.slug}`, label: `Catégorie : ${c.name}` }))
  return [...FIXED_DESTINATIONS, ...extra]
}

/**
 * Destinations proposées à une ENTREPRISE CLIENTE (autre qu'Easy2Book) : uniquement SA page de collecte /o/<identifiant>.
 * Les pages fixes (/, /omra…) et le catalogue (/c/…) sont ceux d'Easy2Book : ils mèneraient le visiteur vers le site et le CRM d'une autre entreprise.
 */
export function companyDestinations(orgSlug: string | null | undefined, orgName?: string | null): Destination[] {
  const slug = String(orgSlug ?? "")
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) || slug === "easy2book") return []
  return [{ path: `/o/${slug}`, label: `Page de collecte${orgName ? ` de ${orgName}` : ""}` }]
}

/** « Été 2027 — Turquie ! » → « ete-2027-turquie » (a-z, 0-9, - et _ ; 64 caractères max). */
export function slugParam(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export interface LinkInput {
  path: string
  source: string
  medium: string
  campaign?: string
  content?: string
  /** Publicité payante : noms et identifiants fournis par la plateforme (recommandé). */
  dynamic?: boolean
}

export type LinkResult = { ok: true; url: string; params: Record<string, string> } | { ok: false; errors: Record<string, string> }

export function buildLink(input: LinkInput, destinations: Destination[], base = SITE_URL): LinkResult {
  const errors: Record<string, string> = {}
  const source = LINK_SOURCES.find((s) => s.id === input.source)
  if (!source) errors.source = "Réseau inconnu."
  const medium = source?.mediums.find((m) => m.id === input.medium)
  if (source && !medium) errors.medium = "Support inconnu pour ce réseau."
  if (!destinations.some((d) => d.path === input.path)) errors.path = "Page de destination inconnue ou masquée."
  const dynamic = Boolean(input.dynamic)
  if (dynamic && !(medium?.id === "paid" && source?.dynamic)) errors.dynamic = "Les paramètres dynamiques ne concernent que les publicités payantes Facebook, Instagram et TikTok."
  const campaign = slugParam(input.campaign || (medium?.id === "bio" ? "bio" : ""))
  if (!dynamic && !campaign) errors.campaign = "Nom de campagne requis (lettres, chiffres, tirets)."
  if (Object.keys(errors).length || !source || !medium) return { ok: false, errors }

  const params: Record<string, string> = { utm_source: source.utm_source, utm_medium: medium.utm_medium }
  let url = `${base.replace(/\/$/, "")}${input.path === "/" ? "/" : input.path}`
  const query = [`utm_source=${params.utm_source}`, `utm_medium=${params.utm_medium}`]
  if (dynamic) {
    // les paramètres dynamiques doivent rester bruts : la plateforme les remplace à chaque affichage
    query.push(source.dynamic!)
  } else {
    params.utm_campaign = campaign
    query.push(`utm_campaign=${campaign}`)
    const content = slugParam(input.content || "")
    if (content) {
      params.utm_content = content
      query.push(`utm_content=${content}`)
    }
  }
  return { ok: true, url: `${url}?${query.join("&")}`, params }
}

/** Liens de bio recommandés pour les comptes officiels (un par réseau, vers l'accueil). */
export function bioLinks(base = SITE_URL): { network: string; url: string }[] {
  return (["instagram", "tiktok", "facebook"] as const).map((id) => {
    const r = buildLink({ path: "/", source: id, medium: id === "facebook" ? "organic" : "bio", campaign: "bio" }, FIXED_DESTINATIONS, base)
    return { network: LINK_SOURCES.find((s) => s.id === id)!.label, url: r.ok ? r.url : "" }
  })
}
