// Compteur de visites SANS cookie ni identifiant publicitaire (Vercel Web Analytics) : mesure d'audience anonyme, indépendante du consentement aux traceurs.
// Avant tout envoi, l'adresse de la page est nettoyée : seuls le chemin et les cinq paramètres UTM de campagne sont conservés (jamais fbclid, ttclid,
// référence de conversation, évènement ni aucun identifiant). L'espace équipe, l'API et les pages des entreprises clientes ne sont jamais comptés.
const KEEP = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
const EXCLUDED_PREFIXES = ["/admin", "/api", "/o"]

/** Adresse nettoyée à envoyer au compteur, ou null si la page ne doit pas être comptée. */
export function cleanVisitUrl(raw: string): string | null {
  let u: URL
  try { u = new URL(raw, "https://visite.invalid") } catch { return null }
  const path = u.pathname
  // « /o » exact ou « /o/... » (entreprises clientes) ; jamais « /omra »
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null
  const keep = new URLSearchParams()
  for (const k of KEEP) {
    const v = u.searchParams.get(k)
    if (v) keep.set(k, v.slice(0, 120))
  }
  const q = keep.toString()
  const origin = u.origin === "https://visite.invalid" ? "" : u.origin
  return `${origin}${path}${q ? `?${q}` : ""}`
}
