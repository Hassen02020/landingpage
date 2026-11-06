// Segments marketing / suivi : fonctions pures sur les clients (Customer 360). AUCUN envoi : on compte et on liste.
// Règle de consentement : un segment « marketing » n'inclut que les clients dont AUCUNE demande n'a refusé / retiré
// le consentement marketing ; un segment « suivi » concerne une demande en cours (consentement de contact, obligatoire).
import { isOpen, isUntreated } from "@/lib/status"
import type { CustomerSummary } from "@/lib/server/customer"

export type SegmentKind = "suivi" | "marketing"

export interface Segment {
  slug: string
  label: string
  description: string
  kind: SegmentKind
  match: (c: CustomerSummary, now: number) => boolean
}

const DAY = 86_400_000
export const idleDays = (c: CustomerSummary, now: number) => Math.floor((now - Date.parse(c.lastActivityAt)) / DAY)

export const SEGMENTS: Segment[] = [
  { slug: "a-traiter", label: "À traiter", description: "Dernière demande nouvelle ou à contacter : aucun premier contact.", kind: "suivi", match: (c) => c.openLeads > 0 && isUntreated(c.lastStatus) },
  { slug: "relance-7j", label: "À relancer (7 jours sans activité)", description: "Dossier en cours, sans activité depuis 7 jours ou plus.", kind: "suivi", match: (c, n) => c.openLeads > 0 && !isUntreated(c.lastStatus) && idleDays(c, n) >= 7 },
  { slug: "proposition-silencieuse", label: "Proposition sans réponse", description: "Devis ou négociation, sans activité depuis 7 jours ou plus.", kind: "suivi", match: (c, n) => (c.lastStatus === "devis" || c.lastStatus === "negociation") && idleDays(c, n) >= 7 },
  { slug: "perdus-recuperables", label: "Perdus à reprendre (60 jours)", description: "Dernière demande perdue, aucune vente, inactif depuis 60 jours ou plus.", kind: "marketing", match: (c, n) => c.lastStatus === "perdu" && c.booked === 0 && idleDays(c, n) >= 60 },
  { slug: "omra-sans-reservation", label: "Omra sans réservation", description: "A demandé l'Omra, aucune vente, aucune demande en cours.", kind: "marketing", match: (c) => c.products.includes("omra") && c.booked === 0 && c.openLeads === 0 },
  { slug: "clients-reserves", label: "Clients ayant réservé", description: "Au moins une réservation ou vente (réservé + gagné).", kind: "marketing", match: (c) => c.booked > 0 },
  { slug: "region-inconnue", label: "Région à renseigner", description: "Aucune région connue : à demander pendant la qualification.", kind: "suivi", match: (c) => c.openLeads > 0 && !c.region },
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

export const getSegment = (slug: string | undefined) => SEGMENTS.find((s) => s.slug === slug)
