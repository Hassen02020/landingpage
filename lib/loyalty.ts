// Fidélité (Bloc 8) — règles décidées par le propriétaire le 06/11/2026 :
//   • base de calcul : chiffre d'affaires cumulé (ventes = réservé + gagné) ;
//   • période : cumul à vie ;
//   • 2 niveaux : « Fidèle » dès la 1re vente, « VIP » à partir d'un seuil de chiffre d'affaires ;
//   • avantages : étiquette + segment uniquement (aucune remise automatique, aucun envoi).
// Le MONTANT du seuil VIP n'est pas encore décidé : il se règle par la variable LANDING_VIP_THRESHOLD_TND.
// Tant qu'elle est absente ou invalide, personne n'est classé VIP (on n'invente pas de seuil).
export type Tier = "vip" | "fidele" | null

export const TIER_LABELS: Record<Exclude<Tier, null>, string> = { vip: "VIP", fidele: "Fidèle" }

/** Seuil VIP en TND (> 0), ou null si non défini. */
export function vipThreshold(raw: string | undefined = process.env.LANDING_VIP_THRESHOLD_TND): number | null {
  if (!raw) return null
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Niveau d'un client : `booked` ventes (réservé + gagné) et `revenue` cumulé (TND). */
export function tierOf(booked: number, revenue: number, threshold: number | null = vipThreshold()): Tier {
  if (booked < 1) return null
  if (threshold !== null && revenue >= threshold) return "vip"
  return "fidele"
}

export const TIER_COLORS: Record<Exclude<Tier, null>, string> = { vip: "bg-amber-100 text-amber-900", fidele: "bg-sky-100 text-sky-800" }
