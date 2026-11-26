// Intelligence Center — Phase 1 : fonctions PURES (testées, sans base) pour la vue d'ensemble et la qualité des données.
// Principes : on affiche ce que les données permettent de dire, rien de plus. Un effectif trop petit est signalé, jamais masqué ;
// on ne confond pas clic, lead, réservation et marge ; aucune donnée personnelle n'est manipulée ici (comptages seulement).
import { isConventionalCampaign } from "@/lib/campaign-name"
import { isBooking, isUntreated, type Status } from "@/lib/status"

/** Nombre minimal de réservations (à commission confirmée) pour comparer sérieusement deux lignes (identique à lib/ad-economics). */
export const MIN_BOOKINGS = 5

export interface SampleState {
  enough: boolean
  n: number
  min: number
  message: string
}

/** « Données insuffisantes : 2 réservation(s), 5 minimum pour comparer. » — message unique réutilisé par toutes les vues. */
export function sampleState(n: number, min: number, noun: string): SampleState {
  const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  const enough = count >= min
  return { enough, n: count, min, message: enough ? "" : `Données insuffisantes pour conclure : ${count} ${noun}, ${min} minimum pour comparer (seuil par défaut, non validé).` }
}

// ------------------------------------------------------------------ qualité des données
export interface QualityLead {
  id: string
  created_at: string
  status: Status
  channel: string | null
  utm_campaign: string | null
  region?: string | null
  tracking_consent?: boolean | null
  /** colonnes de la migration « gouvernance des données » : absentes tant qu'elle n'est pas appliquée */
  is_test?: boolean | null
  lost_reason?: string | null
  purchased_product?: string | null
}

export type Severity = "info" | "warn" | "critical"
export interface QualityIssue {
  key: string
  label: string
  count: number
  total: number
  severity: Severity
  /** pourquoi c'est important et que faire */
  hint: string
}
export interface QualityReport {
  /** leads analysés (les leads marqués « test » sont exclus des contrôles et comptés à part) */
  total: number
  excludedTests: number
  issues: QualityIssue[]
  /** contrôles non calculables avec les colonnes actuelles (migration non appliquée, droit manquant) */
  unavailable: { key: string; label: string; reason: string }[]
}

export interface QualityOptions {
  now?: number
  /** réservations sans commission importée (donnée financière : seulement avec le droit « ads.view ») ; null = non calculable */
  bookingsWithoutCommission?: number | null
  /** la base connaît les colonnes de gouvernance (is_test, lost_reason, purchased_product) */
  governanceColumns?: boolean
  /** délai (heures) au-delà duquel un lead non traité est signalé */
  untreatedAfterHours?: number
  /** journal des conversions Meta (migration 0028) : comptages ; null = journal absent ; undefined = non demandé */
  conversions?: { failed: number; abandoned: number; pending: number } | null
}

const HOUR = 3_600_000

export function qualityReport(allLeads: QualityLead[], opts: QualityOptions = {}): QualityReport {
  const now = opts.now ?? Date.now()
  const gov = opts.governanceColumns === true
  const tests = gov ? allLeads.filter((l) => l.is_test === true) : []
  const leads = gov ? allLeads.filter((l) => l.is_test !== true) : allLeads
  const total = leads.length
  const issues: QualityIssue[] = []
  const unavailable: QualityReport["unavailable"] = []
  const add = (key: string, label: string, count: number, severity: Severity, hint: string) => {
    if (count > 0) issues.push({ key, label, count, total, severity, hint })
  }

  add("region_missing", "Leads sans région", leads.filter((l) => !l.region).length, "info",
    "La région est facultative dans le formulaire ; à demander pendant la qualification pour pouvoir analyser les marchés.")
  add("meta_without_campaign", "Leads Meta sans nom de campagne", leads.filter((l) => l.channel === "meta" && !l.utm_campaign?.trim()).length, "warn",
    "Le lien de l'annonce n'est pas balisé : impossible de savoir quelle campagne a produit le lead. Utilisez /admin/liens.")
  add("campaign_off_convention", "Noms de campagne hors convention", leads.filter((l) => !!l.utm_campaign?.trim() && !isConventionalCampaign(l.utm_campaign.trim())).length, "warn",
    "Majuscules, espaces ou accents dans le nom : les dépenses ne se rattachent pas aux leads. Voir la convention dans /admin/liens.")
  add("no_tracking_consent", "Leads sans consentement de suivi", leads.filter((l) => l.tracking_consent === false).length, "info",
    "Normal si le visiteur a refusé : ni identifiant publicitaire ni évènement envoyé à Meta pour ces leads.")
  const cutoff = now - (opts.untreatedAfterHours ?? 24) * HOUR
  add("untreated", `Leads non traités depuis plus de ${opts.untreatedAfterHours ?? 24} h`, leads.filter((l) => isUntreated(l.status) && Date.parse(l.created_at) < cutoff).length, "critical",
    "Aucun premier contact : le lead refroidit. À traiter en priorité (/admin?followUp=due).")

  if (opts.bookingsWithoutCommission === undefined || opts.bookingsWithoutCommission === null) {
    unavailable.push({ key: "bookings_without_commission", label: "Réservations sans commission importée", reason: "Donnée financière : réservée aux comptes autorisés (rentabilité)." })
  } else {
    add("bookings_without_commission", "Réservations sans commission importée", opts.bookingsWithoutCommission, "critical",
      "Sans commission importée d'EasyV4, la marge de ces ventes n'est pas représentative.")
  }

  if (opts.conversions === null) {
    unavailable.push({ key: "conversions", label: "Conversions Meta en échec", reason: "Journal des conversions non disponible : migration « journal des conversions » (0028) non appliquée." })
  } else if (opts.conversions) {
    add("conversions_failed", "Conversions Meta en échec (relance prévue)", opts.conversions.failed, "critical",
      "Meta n'a pas reçu ces ventes ou qualifications. Elles sont relancées chaque jour, ou tout de suite avec « Relancer maintenant ».")
    add("conversions_abandoned", "Conversions Meta abandonnées", opts.conversions.abandoned, "critical",
      "5 tentatives échouées ou évènement de plus de 7 jours : Meta ne les acceptera plus. Les ventes restent dans le CRM ; Meta ne les a pas vues.")
  }

  if (gov) {
    add("lost_without_reason", "Leads perdus sans motif", leads.filter((l) => l.status === "perdu" && !l.lost_reason).length, "warn",
      "Sans motif (prix, disponibilité, concurrence…), impossible de savoir pourquoi les ventes sont perdues.")
    add("booked_without_product", "Réservations sans produit acheté", leads.filter((l) => isBooking(l.status) && !l.purchased_product).length, "info",
      "Le produit acheté peut différer du produit demandé : à renseigner à la réservation.")
  } else {
    unavailable.push({ key: "governance", label: "Leads de test, motifs de perte, produit acheté", reason: "Migration « gouvernance des données » non appliquée." })
  }

  const order: Record<Severity, number> = { critical: 0, warn: 1, info: 2 }
  issues.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count)
  return { total, excludedTests: tests.length, issues, unavailable }
}

// ------------------------------------------------------------------ vue d'ensemble
export interface OverviewInput {
  leads: number
  qualified: number
  bookings: number
  /** null : l'utilisateur n'a pas le droit de lire les données financières */
  spend: number | null
  marginConfirmed: number | null
  unattachedSpendCount: number
  untreated: number
}
export interface OverviewAlert {
  key: string
  severity: Severity
  text: string
}

/** Alertes issues UNIQUEMENT des chiffres de la période : pas de conseil sans donnée. */
export function overviewAlerts(i: OverviewInput): OverviewAlert[] {
  const out: OverviewAlert[] = []
  if (i.leads === 0) out.push({ key: "no_leads", severity: "info", text: "Aucun lead sur la période." })
  if (i.leads > 0 && i.bookings === 0)
    out.push({ key: "no_bookings", severity: "info", text: `0 réservation sur ${i.leads} lead(s) : aucune conclusion de rentabilité n'est possible (${MIN_BOOKINGS} réservations à commission confirmée minimum pour comparer ; seuil par défaut, non validé).` })
  if (i.spend !== null && i.spend > 0 && i.leads === 0)
    out.push({ key: "spend_without_leads", severity: "warn", text: "Des dépenses sont enregistrées mais aucun lead n'est arrivé : vérifiez les liens de campagne et le suivi." })
  if (i.unattachedSpendCount > 0)
    out.push({ key: "unattached_spend", severity: "warn", text: `${i.unattachedSpendCount} dépense(s) sans lead rattaché (nom de campagne différent ou aucun lead).` })
  if (i.untreated > 0) out.push({ key: "untreated", severity: "critical", text: `${i.untreated} lead(s) sans premier contact : à traiter en priorité.` })
  return out
}
