// Panne du service de données sur une page publique (/c/[slug], /o/[slug]) : ce n'est NI un « introuvable » NI un motif de redirection.
// La page lève cette erreur → Next répond HTTP 500 → app/error.tsx affiche un message compréhensible.
// LIMITE ACCEPTÉE : Next 14 ne sait pas émettre un 503 depuis une page, et le message personnalisé n'apparaît qu'après chargement du JavaScript
// (le HTML du statut 500 ne contient que la coquille de l'application, en noindex).
export type UnavailableReason = "db_error" | "db_not_configured"

export class PublicDataUnavailable extends Error {
  readonly reason: UnavailableReason
  readonly route: string
  constructor(route: string, reason: UnavailableReason) {
    super(`DB_UNAVAILABLE ${route} ${reason}`)
    this.name = "PublicDataUnavailable"
    this.route = route
    this.reason = reason
  }
}

// seul un identifiant de la forme attendue est journalisé : une valeur hostile (retours à la ligne, très long…) ne peut pas polluer les journaux
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/

/** Journal serveur structuré (une ligne JSON) : repérable par une alerte sur « DB_UNAVAILABLE ». Aucune donnée personnelle. */
export function logDbUnavailable(route: string, reason: UnavailableReason, slug?: string): void {
  console.error(JSON.stringify({ event: "DB_UNAVAILABLE", route, reason, ...(slug && SAFE_SLUG.test(slug) ? { slug } : {}), at: new Date().toISOString() }))
}

/** Journalise puis renvoie l'erreur à lever : `throw unavailable("/c/[slug]", "db_error", params.slug)`. */
export function unavailable(route: string, reason: UnavailableReason, slug?: string): PublicDataUnavailable {
  logDbUnavailable(route, reason, slug)
  return new PublicDataUnavailable(route, reason)
}
