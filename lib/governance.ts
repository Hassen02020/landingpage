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
