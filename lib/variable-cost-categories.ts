// Catégories de coûts variables (hors publicité et hors remboursement client, qui ont leurs propres registres).
export const COST_CATEGORIES = ["frais_paiement", "prime_conseiller", "messagerie", "geste_commercial", "autre"] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]
export const COST_LABELS: Record<CostCategory, string> = {
  frais_paiement: "Frais de paiement", prime_conseiller: "Prime du conseiller", messagerie: "Messagerie (WhatsApp…)",
  geste_commercial: "Geste commercial (hors remboursement déjà déduit de la commission)", autre: "Autre",
}

