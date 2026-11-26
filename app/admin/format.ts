import { isBooking, isUntreated } from "@/lib/status"

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

// Présentation des statuts (LOT 1) : couleurs regroupées par PHASE pour une lecture immédiate
// — à traiter (aucun contact) · en cours · vendu (réservé / gagné) · perdu. Libellés et règles : lib/status.ts (inchangés).
// Le badge (StatusBadge) porte aussi un point et le libellé : la couleur n'est jamais la seule information (WCAG 1.4.1).
export type StatusPhase = "a_traiter" | "en_cours" | "vendu" | "perdu"
export const PHASE_LABELS: Record<StatusPhase, string> = { a_traiter: "À traiter", en_cours: "En cours", vendu: "Vendu", perdu: "Perdu" }

export function statusPhase(status: string): StatusPhase {
  if (status === "perdu") return "perdu"
  if (isBooking(status)) return "vendu"
  if (isUntreated(status)) return "a_traiter"
  return "en_cours"
}

export const STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300",
  a_contacter: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300",
  contacte: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
  a_qualifier: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
  qualifie: "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300",
  devis: "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300",
  negociation: "bg-brand-100 text-brand-900 ring-1 ring-inset ring-brand-400",
  reserve: "bg-green-50 text-green-800 ring-1 ring-inset ring-green-300",
  gagne: "bg-green-700 text-white ring-1 ring-inset ring-green-700",
  perdu: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300",
}

/** Montant en dinars pour l'AFFICHAGE seulement (aucun calcul). Par défaut sans décimale, comme la majorité des écrans. */
export function formatTnd(n: number, decimals = 0): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(n)} TND`
}
