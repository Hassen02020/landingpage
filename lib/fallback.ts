// Page de secours : calcul PUR (testable, sans réseau ni base) de la cible vers laquelle renvoyer un visiteur
// dont la page est introuvable, en CONSERVANT sa query string (campagne, clics publicitaires) — même principe que /c/omra-2027 → /omra.
// Seul un « non trouvé » déclenche le secours : une erreur serveur ou une panne de base n'est JAMAIS masquée par une redirection.
export type QueryInput = Record<string, string | string[] | undefined> | URLSearchParams | null | undefined

/** Cibles de secours (décision D1 : valeurs par défaut, à confirmer par le propriétaire). */
export const CATEGORY_FALLBACK = "/voyages-organises"

export type FallbackKind = "category"

/** Paramètres de suivi publicitaire (mêmes noms que lib/attribution.ts : un test vérifie qu'ils ne divergent pas). */
export const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ad_id", "adset_id", "campaign_id", "fbclid", "ttclid", "gclid"] as const

/** « /c/mon-slug » (et « /p/mon-slug », pages du Créateur) → category ; tout autre chemin (ou plusieurs segments) → null.
 *  Aucun secours pour « /o/<entreprise> » : une entreprise inconnue OU suspendue reçoit un 404 neutre (décision du propriétaire). */
export function fallbackKind(pathname: string): FallbackKind | null {
  const clean = String(pathname ?? "").split(/[?#]/)[0].replace(/\/+$/, "")
  return /^\/(c|p)\/[^/]+$/.test(clean) ? "category" : null
}

function pairs(query: QueryInput): [string, string][] {
  if (!query) return []
  if (query instanceof URLSearchParams) return Array.from(query.entries())
  const out: [string, string][] = []
  for (const k of Object.keys(query)) {
    const v = query[k]
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) out.push([k, String(x)])
  }
  return out
}

/** Query string complète (« ?a=1&b=2 », vide si aucun paramètre). */
export function queryString(query: QueryInput): string {
  const qs = new URLSearchParams()
  for (const [k, v] of pairs(query)) qs.append(k, v)
  const s = qs.toString()
  return s ? `?${s}` : ""
}

/** Query string limitée aux paramètres de suivi publicitaire (utilisée par la page 404, qui ne conserve que la campagne). */
export function trackingQuery(query: QueryInput): string {
  const qs = new URLSearchParams()
  for (const [k, v] of pairs(query)) if ((TRACKING_PARAMS as readonly string[]).includes(k)) qs.append(k, v)
  const s = qs.toString()
  return s ? `?${s}` : ""
}

/**
 * Cible de secours pour un chemin introuvable, ou null s'il n'y en a pas (le 404 normal s'applique).
 * Le slug demandé n'est JAMAIS recopié dans la cible : aucune redirection ouverte possible, quelle que soit sa forme.
 */
export function fallbackTarget(pathname: string, query?: QueryInput): string | null {
  if (!fallbackKind(pathname)) return null
  return `${CATEGORY_FALLBACK}${queryString(query)}`
}
