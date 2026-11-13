// CONVENTION UNIQUE DE NOMMAGE DES CAMPAGNES.
// Le même nom doit être utilisé à TROIS endroits : (1) le nom de la campagne dans Meta / TikTok Ads Manager (il alimente utm_campaign
// par le paramètre dynamique), (2) les dépenses saisies dans Landing, (3) les liens de campagne. Sinon dépenses et prospects ne se rapprochent pas.
// Format : minuscules, chiffres et tirets, sans accent ni espace — <niche>-<produit>-<année>[-<variante>], ex. omra-ramadan-2027, turquie-circuit-2027-avril.
export const CAMPAIGN_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const CAMPAIGN_EXAMPLE = "omra-ramadan-2027"

export const isConventionalCampaign = (name: string): boolean => name.length <= 255 && CAMPAIGN_SLUG.test(name)

/** Propose le nom conforme le plus proche (accents retirés, minuscules, séparateurs en tirets). */
export function suggestCampaignName(name: string): string {
  return String(name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255)
}
