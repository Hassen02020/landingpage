// Tableau « Dirigeant » : les cinq questions, une réponse chacune, fonctions PURES (testées, sans base).
// Règle : on répond avec ce que les données permettent. Chaque réponse dit si elle est « exacte », « partielle » ou « indisponible »,
// et ce qui manque. Jamais de 0 % ni de gagnante inventés ; aucune donnée personnelle (comptages et montants agrégés seulement).
import type { EconomicsResult } from "@/lib/ad-economics"

export type Reliability = "exacte" | "partielle" | "indisponible"
export interface Answer {
  /** 1 à 5 : numéro de la question du dirigeant */
  n: 1 | 2 | 3 | 4 | 5
  question: string
  /** valeur affichée (déjà formatée), « — » si indisponible */
  value: string
  reliability: Reliability
  /** phrase simple : ce que le chiffre veut dire, ou ce qui manque pour l'obtenir */
  note: string
}

export interface ExecutiveInput {
  leads: number
  qualified: number
  bookings: number
  /** null : droit « ads.view » absent (données financières non lisibles) */
  finance: EconomicsResult | null
}

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`

export function executiveAnswers(i: ExecutiveInput): Answer[] {
  const out: Answer[] = []
  const F = i.finance
  const m = F?.total.metrics

  // 1. Dépenses
  if (!F || !m) {
    out.push({ n: 1, question: "Combien avons-nous dépensé pour attirer les prospects ?", value: "—", reliability: "indisponible", note: "Réservé aux comptes autorisés (rentabilité)." })
  } else if (m.spend <= 0) {
    out.push({ n: 1, question: "Combien avons-nous dépensé pour attirer les prospects ?", value: "—", reliability: "indisponible", note: "Aucune dépense saisie sur la période : le coût par lead n'est pas calculable. Saisir ou importer les dépenses Meta dans Rentabilité." })
  } else {
    const unatt = F.unattachedSpend.length
    out.push({
      n: 1, question: "Combien avons-nous dépensé pour attirer les prospects ?", value: tnd(m.spend),
      reliability: unatt > 0 ? "partielle" : "exacte",
      note: `${m.cpl === null ? "Coût par lead non calculable" : `Coût par lead : ${tnd(m.cpl)}`}.${unatt > 0 ? ` ${unatt} dépense(s) sans lead rattaché (nom de campagne différent).` : ""}`,
    })
  }

  // 2. Qualifiés
  out.push({
    n: 2, question: "Combien sont réellement qualifiés ?", value: `${i.qualified} sur ${i.leads}`,
    reliability: i.leads === 0 ? "indisponible" : "exacte",
    note: i.leads === 0 ? "Aucun lead sur la période."
      : `A atteint « qualifié » ou plus loin${m && m.costPerQualified !== null ? `. Coût par lead qualifié : ${tnd(m.costPerQualified)}` : ""}.`,
  })

  // 3. Réservations
  out.push({
    n: 3, question: "Combien ont réservé ?", value: String(i.bookings),
    reliability: i.leads === 0 ? "indisponible" : "exacte",
    note: i.leads === 0 ? "Aucun lead sur la période." : i.bookings === 0
      ? `0 réservation sur ${i.leads} lead(s). Le statut « réservé » est posé par l'équipe : à vérifier si des ventes ont eu lieu hors du CRM.`
      : `${i.bookings} réservation(s) comptée(s) une seule fois${m && m.costPerBooking !== null ? `. Coût par réservation : ${tnd(m.costPerBooking)}` : ""}.`,
  })

  // 4. Gain réel
  if (!F || !m) {
    out.push({ n: 4, question: "Combien Easy2Book a réellement gagné ?", value: "—", reliability: "indisponible", note: "Réservé aux comptes autorisés (rentabilité)." })
  } else if (i.bookings === 0) {
    out.push({ n: 4, question: "Combien Easy2Book a réellement gagné ?", value: "—", reliability: "indisponible", note: "Aucune réservation : aucun gain à mesurer." })
  } else {
    const missing = m.bookingsWithoutCommission
    out.push({
      n: 4, question: "Combien Easy2Book a réellement gagné ?", value: tnd(m.marginConfirmed),
      reliability: missing > 0 || m.commissionConfirmed <= 0 ? "partielle" : "exacte",
      note: `Marge nette sur commissions CONFIRMÉES seulement (commissions − publicité − coûts).${missing > 0 ? ` ${missing} réservation(s) sans commission importée : la marge est sous-estimée tant qu'elles ne sont pas importées.` : ""}${m.commissionProvisional > 0 ? ` ${tnd(m.commissionProvisional)} de commissions provisoires non comptés.` : ""}`,
    })
  }

  // 5. Prochaine campagne à financer
  if (!F) {
    out.push({ n: 5, question: "Quelle campagne mérite le prochain dinar publicitaire ?", value: "—", reliability: "indisponible", note: "Réservé aux comptes autorisés (rentabilité)." })
  } else {
    const w = F.winnerKey ? F.rows.find((r) => r.key === F.winnerKey) : undefined
    if (w) {
      out.push({ n: 5, question: "Quelle campagne mérite le prochain dinar publicitaire ?", value: w.label, reliability: w.hasProvisional ? "partielle" : "exacte", note: F.winnerReason })
    } else {
      out.push({ n: 5, question: "Quelle campagne mérite le prochain dinar publicitaire ?", value: "Aucune pour l'instant", reliability: "indisponible", note: F.winnerReason || "Données insuffisantes." })
    }
  }
  return out
}
