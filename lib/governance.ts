// Gouvernance des données (migration 0026) : listes contrôlées, partagées par le serveur, les écrans et les tests.
import { PRODUCTS, isProduct, type Product } from "@/lib/config"

export const LOSS_REASONS = ["prix", "disponibilite", "delai_reponse", "concurrence", "pas_de_suivi", "injoignable", "plus_interesse", "hors_zone", "autre"] as const
export type LossReason = (typeof LOSS_REASONS)[number]

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  prix: "Prix",
  disponibilite: "Disponibilité",
  delai_reponse: "Délai de réponse",
  concurrence: "Concurrence",
  pas_de_suivi: "Absence de suivi",
  injoignable: "Injoignable",
  plus_interesse: "Plus intéressé",
  hors_zone: "Hors zone",
  autre: "Autre",
}

export const isLossReason = (v: unknown): v is LossReason => typeof v === "string" && (LOSS_REASONS as readonly string[]).includes(v)

/** Produit réellement acheté : mêmes valeurs que le produit demandé. */
export const PURCHASED_PRODUCTS = Object.keys(PRODUCTS) as Product[]
export { isProduct as isPurchasedProduct }
export type { Product }

/**
 * Passage à « perdu » depuis un écran : le motif est obligatoire (sinon impossible de savoir pourquoi on perd des ventes).
 * `existing` : motif déjà enregistré sur le lead (un lead déjà perdu avec motif peut être ré-enregistré sans le redemander).
 * Renvoie le message d'erreur à afficher, ou null si tout est en règle. Les passages automatiques (doublon, API) restent possibles.
 */
export function lossReasonError(status: string, reason: string | null | undefined, existing?: string | null): string | null {
  if (status !== "perdu") return null
  if (reason) return isLossReason(reason) ? null : "Motif de perte invalide."
  return existing && isLossReason(existing) ? null : "Choisissez le motif de perte avant d'enregistrer : prix, disponibilité, injoignable…"
}
