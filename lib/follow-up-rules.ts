// Règles de relance (lot B) — PURES, sans accès base. Elles produisent des ALERTES et des SUGGESTIONS pour les conseillers ;
// elles n'envoient AUCUN message au client (consentement, fenêtre WhatsApp, modèles autorisés et désinscription restent à respecter).
// Les seuils ci-dessous sont des valeurs PAR DÉFAUT proposées, à valider par le propriétaire (aucun chiffre commercial inventé).
import { isBooking, isOpen, isUntreated } from "@/lib/status"

export interface RuleConfig {
  firstResponseMinutes: number // délai avant qu'un dossier jamais traité devienne urgent
  escalateAfterMinutes: number // délai avant d'alerter aussi le responsable
  quoteSilenceDays: number // jours sans échange après un devis avant de proposer une relance
}
export const DEFAULT_RULES: RuleConfig = { firstResponseMinutes: 60, escalateAfterMinutes: 240, quoteSilenceDays: 3 }

export type RuleId = "new_unanswered" | "overdue_followup" | "quote_no_answer" | "owner_inactive" | "unassigned"
export type Severity = "urgent" | "normal"

export interface RuleLead {
  id: string
  ref: string
  status: string
  created_at: string
  assigned_to: string | null
  next_follow_up_at: string | null
  last_activity_at: string | null // dernier échange enregistré (historique), sinon null
}
export interface RuleContext { now: Date; activeStaffIds: ReadonlySet<string>; config?: RuleConfig }

export interface Alert { leadId: string; ref: string; rule: RuleId; severity: Severity; escalate: boolean; message: string; suggestion: string }

const MIN = 60_000, DAY = 24 * 60 * MIN
const t = (iso: string | null | undefined): number | null => { const v = iso ? Date.parse(iso) : NaN; return Number.isNaN(v) ? null : v }

/** Un dossier réservé, gagné ou perdu ne reçoit plus de relance de conversion (« client réserve » : on arrête ; « client refuse » : on respecte son choix). */
export const shouldStopConversionFollowUps = (status: string): boolean => isBooking(status) || status === "perdu"

export function evaluateLead(lead: RuleLead, ctx: RuleContext): Alert[] {
  if (!isOpen(lead.status)) return [] // fermé : aucune règle de conversion
  const cfg = ctx.config ?? DEFAULT_RULES, now = ctx.now.getTime(), out: Alert[] = []
  const add = (rule: RuleId, severity: Severity, message: string, suggestion: string, escalate = false) => out.push({ leadId: lead.id, ref: lead.ref, rule, severity, escalate, message, suggestion })

  const created = t(lead.created_at)
  if (isUntreated(lead.status) && created !== null) {
    const waited = Math.floor((now - created) / MIN)
    if (waited >= cfg.firstResponseMinutes) {
      add("new_unanswered", "urgent", `Jamais traité depuis ${fmtDuration(waited)}`, "Contacter le client maintenant", waited >= cfg.escalateAfterMinutes)
    }
  }
  const due = t(lead.next_follow_up_at)
  if (due !== null && due <= now) add("overdue_followup", "normal", `Relance prévue il y a ${fmtDuration(Math.floor((now - due) / MIN))}`, "Relancer ou reprogrammer")
  if (lead.status === "devis" || lead.status === "negociation") {
    const last = t(lead.last_activity_at) ?? created
    if (last !== null && now - last >= cfg.quoteSilenceDays * DAY && (due === null || due <= now)) {
      add("quote_no_answer", "normal", `Devis sans échange depuis ${Math.floor((now - last) / DAY)} jour(s)`, "Programmer une relance")
    }
  }
  if (!lead.assigned_to) add("unassigned", isUntreated(lead.status) ? "urgent" : "normal", "Aucun responsable", "Affecter un conseiller")
  else if (!ctx.activeStaffIds.has(lead.assigned_to)) add("owner_inactive", "urgent", "Le responsable n'est plus actif dans l'équipe", "Réaffecter le dossier", true)
  return out
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 2 * 24 * 60) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / (24 * 60))} j`
}

const RANK: Record<Severity, number> = { urgent: 0, normal: 1 }
/** Liste de travail : urgents d'abord, puis les plus anciens. Un même dossier peut porter plusieurs alertes. */
export function buildWorklist(leads: RuleLead[], ctx: RuleContext): Alert[] {
  const age = new Map(leads.map((l) => [l.id, t(l.created_at) ?? 0]))
  return leads.flatMap((l) => evaluateLead(l, ctx)).sort((a, b) => RANK[a.severity] - RANK[b.severity] || (age.get(a.leadId) ?? 0) - (age.get(b.leadId) ?? 0))
}

export const RULE_LABELS: Record<RuleId, string> = {
  new_unanswered: "Nouveau sans réponse", overdue_followup: "Relance échue", quote_no_answer: "Devis sans réponse", owner_inactive: "Responsable inactif", unassigned: "Sans responsable",
}
