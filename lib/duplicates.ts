// Doublons de dossiers — règles PURES (sans base, sans réseau). Elles DÉTECTENT et SIGNALENT ; elles ne décident jamais.
// Règles métier validées (23/11/2026) :
//   1. doublon technique potentiel : même client, même produit, même offre et même départ, créés à ≤ 15 minutes d'écart ;
//   2. doublon commercial potentiel : mêmes critères, à ≤ 30 jours d'écart ;
//   3. une nouvelle demande après plusieurs jours est un intérêt renouvelé : au-delà de 30 jours, AUCUN signalement.
// Les fenêtres servent à signaler, jamais à prouver : toute décision est humaine, tracée et réversible.
import { isBooking } from "@/lib/status"

export const TECHNICAL_WINDOW_MS = 15 * 60 * 1000
export const COMMERCIAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export const DUP_STATUSES = ["signale", "confirme", "rejete"] as const
export type DupStatus = (typeof DUP_STATUSES)[number]
/** « non examiné » n'est pas un statut stocké : c'est un candidat détecté, sans signalement. */
export const DUP_STATUS_LABELS: Record<DupStatus | "non_examine", string> = { non_examine: "Non examiné", signale: "Signalé", confirme: "Confirmé", rejete: "Rejeté" }
export const DUP_RULES = ["technique_15min", "commerciale_30j", "reservation", "manuel"] as const
export type DupRule = (typeof DUP_RULES)[number]
export const DUP_RULE_LABELS: Record<DupRule, string> = { technique_15min: "Technique (15 min)", commerciale_30j: "Commerciale (30 jours)", reservation: "Réservation", manuel: "Manuel" }
export type DupConfidence = "elevee" | "faible"
export type PurchaseState = "aucun" | "retenu" | "envoye"

/** Transitions autorisées : décision (signale → confirme | rejete) et réouverture (confirme | rejete → signale). Jamais confirme ↔ rejete directement. */
export function canTransition(from: DupStatus, to: DupStatus): boolean {
  return (from === "signale" && (to === "confirme" || to === "rejete")) || ((from === "confirme" || from === "rejete") && to === "signale")
}

export interface DupLead {
  id: string
  organization_id?: string | null
  phone: string | null
  product: string
  offer: string | null
  offer_id?: string | null
  travel_date?: string | null
  created_at: string
  status: string
  is_test?: boolean | null
  anonymized_at?: string | null
  duplicate_of?: string | null
}

export const PHONE_RE = /^\d{8,15}$/
export const hasValidPhone = (p: string | null | undefined): p is string => typeof p === "string" && PHONE_RE.test(p)

/** Libellé d'offre comparable : sans accents ni marques arabes (voyelles, allongement), minuscules, ponctuation et espaces uniformisés. */
export function normalizeOffer(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "") // harakat arabes et tatweel
    .replace(/[̀-ͯ]/g, "") // marques combinantes latines (après NFD ci-dessous)
    .toLowerCase()
  const folded = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s\-–—_/|·.,;:()]+/g, " ").trim()
  return folded.length ? folded : null
}

export type Comparison = "same" | "different" | "unknown"

/** Offre : identifiant d'offre quand il existe des deux côtés, sinon libellé normalisé, sinon inconnu. */
export function compareOffer(a: Pick<DupLead, "offer" | "offer_id">, b: Pick<DupLead, "offer" | "offer_id">): Comparison {
  if (a.offer_id && b.offer_id) return a.offer_id === b.offer_id ? "same" : "different"
  const x = normalizeOffer(a.offer), y = normalizeOffer(b.offer)
  if (x && y) return x === y ? "same" : "different"
  return "unknown"
}
/** Départ : date de voyage quand elle existe des deux côtés ; sinon inconnu (le libellé de l'offre porte souvent le départ). */
export function compareDeparture(a: Pick<DupLead, "travel_date">, b: Pick<DupLead, "travel_date">): Comparison {
  if (a.travel_date && b.travel_date) return a.travel_date === b.travel_date ? "same" : "different"
  return "unknown"
}
/** Offre ET départ : « different » dès qu'un des deux diffère ; « same » si au moins un est identique et aucun ne diffère ; sinon « unknown ». */
export function compareOffering(a: DupLead, b: DupLead): Comparison {
  const o = compareOffer(a, b), d = compareDeparture(a, b)
  if (o === "different" || d === "different") return "different"
  if (o === "same" || d === "same") return "same"
  return "unknown"
}

const isLive = (l: DupLead) => l.is_test !== true && !l.anonymized_at

export interface DupCandidate {
  candidateId: string // le dossier le plus RÉCENT (présumé doublon)
  primaryId: string // le plus ancien (présumé principal)
  rule: Exclude<DupRule, "manuel" | "reservation">
  confidence: DupConfidence
  deltaMinutes: number
}

/** Candidats de doublon pour un dossier, parmi les autres dossiers. Même client (téléphone valide identique), même produit, offre/départ non différents,
 *  écart ≤ 30 jours. `unknown` (offre ou départ non comparables) donne une confiance FAIBLE, jamais une affirmation. */
export function detectCandidates(lead: DupLead, others: DupLead[]): DupCandidate[] {
  if (!hasValidPhone(lead.phone) || !isLive(lead) || lead.duplicate_of) return []
  const t0 = Date.parse(lead.created_at)
  if (Number.isNaN(t0)) return []
  const out: DupCandidate[] = []
  for (const o of others) {
    if (o.id === lead.id || !isLive(o) || o.duplicate_of || o.phone !== lead.phone || o.product !== lead.product) continue
    if (lead.organization_id && o.organization_id && lead.organization_id !== o.organization_id) continue
    const t1 = Date.parse(o.created_at)
    if (Number.isNaN(t1)) continue
    const delta = Math.abs(t0 - t1)
    if (delta > COMMERCIAL_WINDOW_MS) continue // règle 3 : intérêt renouvelé, pas un doublon
    const cmp = compareOffering(lead, o)
    if (cmp === "different") continue
    const newer = t0 >= t1 ? lead : o, older = t0 >= t1 ? o : lead
    out.push({ candidateId: newer.id, primaryId: older.id, rule: delta <= TECHNICAL_WINDOW_MS ? "technique_15min" : "commerciale_30j", confidence: cmp === "same" ? "elevee" : "faible", deltaMinutes: Math.floor(delta / 60000) })
  }
  return out.sort((a, b) => a.deltaMinutes - b.deltaMinutes)
}

/** Dossier principal PROPOSÉ (D7) : celui qui porte déjà un Purchase envoyé ; sinon le plus ancien. Le Manager peut en choisir un autre. */
export function suggestPrimary(a: { id: string; created_at: string; purchaseSent: boolean }, b: { id: string; created_at: string; purchaseSent: boolean }): { primaryId: string; candidateId: string; reason: "purchase_envoye" | "plus_ancien" } {
  if (a.purchaseSent !== b.purchaseSent) return a.purchaseSent ? { primaryId: a.id, candidateId: b.id, reason: "purchase_envoye" } : { primaryId: b.id, candidateId: a.id, reason: "purchase_envoye" }
  const aOlder = Date.parse(a.created_at) <= Date.parse(b.created_at)
  return aOlder ? { primaryId: a.id, candidateId: b.id, reason: "plus_ancien" } : { primaryId: b.id, candidateId: a.id, reason: "plus_ancien" }
}

export interface ReservationOther extends DupLead { purchaseSentOrPending?: boolean }
export interface ReservationConflict { id: string; ref?: string; status: string; confidence: DupConfidence; assigned_to?: string | null }

/** Autres dossiers du même client, même produit, même offre/départ (non différents), déjà RÉSERVÉS / GAGNÉS ou portant un Purchase envoyé / en attente,
 *  qui ne sont pas des doublons confirmés. Pas de fenêtre de temps : deux réservations pour la même clé exigent TOUJOURS une décision humaine. */
export function findReservationConflicts(lead: DupLead, others: (ReservationOther & { ref?: string })[]): ReservationConflict[] {
  if (!hasValidPhone(lead.phone) || !isLive(lead)) return []
  const out: ReservationConflict[] = []
  for (const o of others) {
    if (o.id === lead.id || !isLive(o) || o.duplicate_of || o.phone !== lead.phone || o.product !== lead.product) continue
    if (lead.organization_id && o.organization_id && lead.organization_id !== o.organization_id) continue
    if (!isBooking(o.status) && !o.purchaseSentOrPending) continue
    const cmp = compareOffering(lead, o)
    if (cmp === "different") continue
    out.push({ id: o.id, ref: o.ref, status: o.status, confidence: cmp === "same" ? "elevee" : "faible", ...("assigned_to" in o ? { assigned_to: (o as { assigned_to?: string | null }).assigned_to ?? null } : {}) })
  }
  return out
}
