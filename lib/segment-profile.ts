// Fiche d'un segment (D2) : effectif, provenance, fiabilité. Fonctions PURES. Rien n'est exporté ni envoyé.
// L'effectif est EXACT dans le CRM ; la taille réelle d'une audience chez une plateforme dépend d'un taux de correspondance INCONNU : on ne l'invente pas.
import type { SegmentResult } from "@/lib/segments"
import { adAudienceVerdict, type AdAudienceVerdict } from "@/lib/segments"

export type Reliability = "insuffisante" | "faible" | "moyenne" | "elevee"
export const RELIABILITY_LABELS: Record<Reliability, string> = { insuffisante: "Insuffisante", faible: "Faible", moyenne: "Moyenne", elevee: "Élevée" }

// Seuils PAR DÉFAUT proposés, à valider par le propriétaire.
export const MIN_SAMPLE = 30 // en dessous : échantillon insuffisant pour toute conclusion
export const GOOD_SAMPLE = 100
export const MAX_EXCLUDED_SHARE = 0.5 // plus de la moitié exclue faute de consentement : la liste n'est pas représentative

export interface SegmentProfile {
  size: number // membres du segment
  eligible: number // contactables (consentement marketing si segment marketing)
  excluded: number
  sources: { channel: string; count: number }[] // provenance : canal d'arrivée des clients éligibles
  regionKnownShare: number // part avec région connue (0..1)
  reliability: Reliability
  reasons: string[] // pourquoi ce niveau
  adAudience: AdAudienceVerdict
}

export function profileSegment(result: SegmentResult): SegmentProfile {
  const { members, eligible, excluded, segment } = result
  const counts = new Map<string, number>()
  for (const c of eligible) for (const ch of c.channels.length ? c.channels : ["inconnu"]) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  const sources = Array.from(counts, ([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count)
  const regionKnownShare = eligible.length ? eligible.filter((c) => c.region).length / eligible.length : 0
  const reasons: string[] = []
  let level: Reliability
  if (eligible.length < MIN_SAMPLE) { level = "insuffisante"; reasons.push(`Seulement ${eligible.length} contact(s) éligible(s) : sous le seuil de ${MIN_SAMPLE}, aucune conclusion ni taux fiable : données insuffisantes pour conclure (seuil par défaut, non validé).`) }
  else {
    level = eligible.length >= GOOD_SAMPLE ? "elevee" : "moyenne"
    reasons.push(`${eligible.length} contacts éligibles (${eligible.length >= GOOD_SAMPLE ? "échantillon suffisant" : `entre ${MIN_SAMPLE} et ${GOOD_SAMPLE - 1}`}).`)
    if (members.length && excluded / members.length > MAX_EXCLUDED_SHARE) { level = level === "elevee" ? "moyenne" : "faible"; reasons.push(`${Math.round((excluded / members.length) * 100)} % des membres sont exclus faute de consentement marketing : liste peu représentative.`) }
    if (regionKnownShare < 0.5) { level = level === "elevee" ? "moyenne" : level === "moyenne" ? "faible" : level; reasons.push(`Région connue pour ${Math.round(regionKnownShare * 100)} % seulement : ciblage géographique peu fiable.`) }
  }
  return { size: members.length, eligible: eligible.length, excluded, sources, regionKnownShare, reliability: level, reasons, adAudience: adAudienceVerdict(segment) }
}
