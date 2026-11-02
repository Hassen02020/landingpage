// Validations partagées (formulaire public, API, CRM).
export const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$/

/** Adresse e-mail normalisée, ou null si absente / invalide (l'e-mail est facultatif : jamais bloquant). */
export function cleanEmail(v: unknown): string | null {
  const e = typeof v === "string" ? v.trim().toLowerCase() : ""
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null
}
