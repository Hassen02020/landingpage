// STATISTIQUES COMMERCIALES D'UNE PAGE — logique PURE (testée). Règles :
//  • jamais le chiffre d'affaires d'une réservation présenté comme gain : seule la COMMISSION CONFIRMÉE compte ;
//  • toute donnée absente affiche « NON DISPONIBLE » (jamais 0 par défaut, jamais une estimation déguisée) ;
//  • les dépenses d'une campagne partagée entre plusieurs pages sont réparties au prorata des prospects : signalé « estimée ».
import type { Metrics, SpendBasis } from "@/lib/ad-economics"

export const UNAVAILABLE = "NON DISPONIBLE"

export interface StatInput {
  /** ligne « niche = adresse de la page » du moteur de rentabilité, ou null si aucun prospect sur la période */
  metrics: Metrics | null
  spendBasis: SpendBasis
  /** tables dépenses / commissions présentes (migration 0016 appliquée) */
  ledgerAvailable: boolean
  /** visiteurs distincts ayant ACCEPTÉ le suivi et ouvert une offre de la page */
  consentingVisitors: number | null
}

export type StatGroup = "audience" | "commercial" | "financier"
export const GROUP_LABELS: Record<StatGroup, string> = { audience: "Audience (qui a vu la page)", commercial: "Résultats commerciaux (prospects du CRM)", financier: "Résultats financiers (jamais le chiffre d'affaires)" }

export interface StatCard {
  id: string
  group: StatGroup
  label: string
  /** nombre (TND si kind = "money") ; null = non disponible */
  value: number | null
  kind: "count" | "money"
  note: string
  tone: "plain" | "warn"
}

export function pageStats(i: StatInput): StatCard[] {
  const m = i.metrics
  const zero = (n: number | undefined) => n ?? 0
  const spendKnown = i.ledgerAvailable && i.spendBasis !== "aucune"
  const cards: StatCard[] = []
  const GROUPS: Record<string, StatGroup> = { visites: "audience", visiteurs: "audience", prospects: "commercial", qualifies: "commercial", devis: "commercial", reservations: "commercial", commission: "financier", depenses: "financier", marge: "financier" }
  const add = (c: Omit<StatCard, "tone" | "group"> & { tone?: StatCard["tone"] }) => cards.push({ tone: "plain", group: GROUPS[c.id], ...c })

  add({ id: "visites", label: "Visites de la page", value: null, kind: "count", note: "Non mesurées : le site ne compte pas les visiteurs qui refusent le suivi. Un compteur anonyme est proposé (docs/PROPOSITION_VISITES_PAGES.md), non activé." })
  add({ id: "visiteurs", label: "Visiteurs ayant accepté le suivi", value: i.consentingVisitors, kind: "count", note: i.consentingVisitors === null ? "Lecture impossible." : "Visiteurs distincts qui ont ouvert une offre ; sous-estime les visites réelles." })
  add({ id: "prospects", label: "Prospects", value: zero(m?.leads), kind: "count", note: "Demandes reçues par le formulaire de cette page (CRM Easy2Book)." })
  add({ id: "qualifies", label: "Prospects qualifiés", value: zero(m?.qualified), kind: "count", note: "Prospects ayant atteint au moins l'étape « qualifié »." })
  add({ id: "devis", label: "Demandes de devis", value: zero(m?.quotes), kind: "count", note: "Prospects ayant atteint l'étape « devis / proposition »." })
  add({ id: "reservations", label: "Réservations confirmées", value: i.ledgerAvailable ? zero(m?.confirmedBookings) : null, kind: "count",
    note: !i.ledgerAvailable ? "Registre des commissions non installé." : zero(m?.bookings) > zero(m?.confirmedBookings) ? `${zero(m?.bookings)} réservation(s) enregistrée(s), dont ${zero(m?.confirmedBookings)} avec commission confirmée.` : "Réservations dont la commission nette est confirmée.",
    tone: zero(m?.bookingsWithoutCommission) > 0 ? "warn" : "plain" })
  add({ id: "commission", label: "Commission réellement conservée", value: i.ledgerAvailable ? zero(m?.commissionConfirmed) : null, kind: "money",
    note: !i.ledgerAvailable ? "Registre des commissions non installé." : `Commission nette CONFIRMÉE (annulations et remboursements déduits). ${zero(m?.commissionProvisional) !== 0 ? `Provisoire, non comptée : ${zero(m?.commissionProvisional)} TND. ` : ""}Le chiffre d'affaires des réservations n'est jamais utilisé ici.`,
    tone: zero(m?.bookingsWithoutCommission) > 0 ? "warn" : "plain" })
  add({ id: "depenses", label: "Dépenses publicitaires", value: spendKnown ? zero(m?.spend) : null, kind: "money",
    note: !i.ledgerAvailable ? "Registre des dépenses non installé." : i.spendBasis === "aucune" ? "Aucune dépense saisie pour les campagnes de cette page." : i.spendBasis === "estimee" ? "Estimée : la campagne alimente plusieurs pages, la dépense est répartie au prorata des prospects." : "Dépense exacte des campagnes de cette page.",
    tone: i.spendBasis === "estimee" ? "warn" : "plain" })
  add({ id: "marge", label: "Marge nette", value: spendKnown && i.ledgerAvailable ? zero(m?.marginConfirmed) : null, kind: "money",
    note: !spendKnown ? "Non calculable sans dépenses saisies." : `Commissions confirmées − dépenses − coûts variables.${zero(m?.bookingsWithoutCommission) > 0 ? ` Non représentative : ${zero(m?.bookingsWithoutCommission)} réservation(s) sans commission importée.` : ""}${i.spendBasis === "estimee" ? " Dépenses estimées." : ""}`,
    tone: zero(m?.bookingsWithoutCommission) > 0 || i.spendBasis === "estimee" ? "warn" : "plain" })
  return cards
}

export const formatStat = (c: StatCard): string =>
  c.value === null ? UNAVAILABLE : c.kind === "money" ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(c.value)} TND` : new Intl.NumberFormat("fr-FR").format(c.value)
