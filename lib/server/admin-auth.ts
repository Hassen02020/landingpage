import { timingSafeEqual } from "crypto"

/**
 * Authentifie les endpoints d'administration (export, statut) avec LANDING_ADMIN_API_KEY.
 * En-tête uniquement (jamais dans l'URL, pour ne pas fuiter dans les journaux).
 * Clé absente ou trop courte (< 32 caractères) → tout est refusé.
 */
export function isAdminRequest(headers: Headers): boolean {
  const expected = process.env.LANDING_ADMIN_API_KEY
  if (!expected || expected.length < 32) return false
  const auth = headers.get("authorization")
  const provided = headers.get("x-api-key") || (auth?.startsWith("Bearer ") ? auth.slice(7) : "")
  const a = Buffer.from(provided || "")
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
