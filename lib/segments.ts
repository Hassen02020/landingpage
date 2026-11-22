// Segments marketing / suivi : fonctions pures sur les clients (Customer 360). AUCUN envoi : on compte et on liste.
// Règle de consentement : un segment « marketing » n'inclut que les clients dont AUCUNE demande n'a refusé / retiré
// le consentement marketing ; un segment « suivi » concerne une demande en cours (consentement de contact, obligatoire).
import { isOpen, isUntreated } from "@/lib/status"
import type { CustomerSummary } from "@/lib/server/customer"

export type SegmentKind = "suivi" | "marketing"

/** Sensibilité (règle de protection acceptée le 22/11/2026) : un segment « sensible » est déduit d'une donnée dont l'inférence est sensible
 *  (ex. demande d'Omra = indicateur de conviction religieuse). Il reste un usage INTERNE : jamais d'audience publicitaire, jamais d'export. */
export type Sensitivity = "none" | "sensitive"
export const SENSITIVE_PRODUCTS: readonly string[] = ["omra"]

export interface Segment {
  slug: string
  label: string
  description: string
  kind: SegmentKind
  sensitivity: Sensitivity
  match: (c: CustomerSummary, now: number) => boolean
}

const DAY = 86_400_000
export const idleDays = (c: CustomerSummary, now: number) => Math.floor((now - Date.parse(c.lastActivityAt)) / DAY)

export const SEGMENTS: Segment[] = [
  { slug: "a-traiter", label: "À traiter", description: "Dernière demande nouvelle ou à contacter : aucun premier contact.", kind: "suivi", sensitivity: "none", match: (c) => c.openLeads > 0 && isUntreated(c.lastStatus) },
  { slug: "relance-7j", label: "À relancer (7 jours sans activité)", description: "Dossier en cours, sans activité depuis 7 jours ou plus.", kind: "suivi", sensitivity: "none", match: (c, n) => c.openLeads > 0 && !isUntreated(c.lastStatus) && idleDays(c, n) >= 7 },
  { slug: "proposition-silencieuse", label: "Proposition sans réponse", description: "Devis ou négociation, sans activité depuis 7 jours ou plus.", kind: "suivi", sensitivity: "none", match: (c, n) => (c.lastStatus === "devis" || c.lastStatus === "negociation") && idleDays(c, n) >= 7 },
  { slug: "perdus-recuperables", label: "Perdus à reprendre (60 jours)", description: "Dernière demande perdue, aucune vente, inactif depuis 60 jours ou plus.", kind: "marketing", sensitivity: "none", match: (c, n) => c.lastStatus === "perdu" && c.booked === 0 && idleDays(c, n) >= 60 },
  { slug: "omra-sans-reservation", label: "Omra sans réservation", description: "A demandé l'Omra, aucune vente, aucune demande en cours.", kind: "marketing", sensitivity: "sensitive", match: (c) => c.products.includes("omra") && c.booked === 0 && c.openLeads === 0 },
  { slug: "vip", label: "Clients VIP", description: "Chiffre d'affaires cumulé à vie au-dessus du seuil VIP (variable LANDING_VIP_THRESHOLD_TND ; vide tant que le seuil n'est pas défini).", kind: "marketing", sensitivity: "none", match: (c) => c.tier === "vip" },
  { slug: "clients-reserves", label: "Clients ayant réservé", description: "Au moins une réservation ou vente (réservé + gagné).", kind: "marketing", sensitivity: "none", match: (c) => c.booked > 0 },
  { slug: "region-inconnue", label: "Région à renseigner", description: "Aucune région connue : à demander pendant la qualification.", kind: "suivi", sensitivity: "none", match: (c) => c.openLeads > 0 && !c.region },
]

export interface SegmentResult {
  segment: Segment
  members: CustomerSummary[]
  eligible: CustomerSummary[] // contactables dans le cadre du segment (marketing : consentement requis)
  excluded: number // exclus faute de consentement marketing
}

export function eligibleFor(segment: Segment, c: CustomerSummary): boolean {
  return segment.kind === "suivi" ? true : c.marketingOk
}

export function evaluate(customers: CustomerSummary[], now = Date.now()): SegmentResult[] {
  return SEGMENTS.map((segment) => {
    const members = customers.filter((c) => segment.match(c, now))
    const eligible = members.filter((c) => eligibleFor(segment, c))
    return { segment, members, eligible, excluded: members.length - eligible.length }
  })
}

export interface AdAudienceVerdict { allowed: boolean; reason: string }

/** Ce segment peut-il SERVIR À CONSTRUIRE une audience publicitaire ? « allowed » = éligible à l'examen, JAMAIS une activation :
 *  la validation humaine du propriétaire reste obligatoire, ainsi que le consentement marketing de chaque contact. */
export function adAudienceVerdict(segment: Pick<Segment, "kind" | "sensitivity">): AdAudienceVerdict {
  if (segment.sensitivity === "sensitive") return { allowed: false, reason: "Donnée sensible ou inférence sensible : usage interne uniquement, aucune audience publicitaire ni export." }
  if (segment.kind === "suivi") return { allowed: false, reason: "Segment de suivi commercial (relances) : pas une audience publicitaire." }
  return { allowed: true, reason: "Éligible à l'examen, sous validation humaine et consentement marketing de chaque contact. Rien n'est activé." }
}

export const getSegment = (slug: string | undefined) => SEGMENTS.find((s) => s.slug === slug)
