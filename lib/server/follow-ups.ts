// Liste « À traiter » (lot B) : lit les dossiers ouverts, l'équipe active et le dernier échange, applique les règles pures.
// Lecture seule : aucune écriture, aucun message envoyé. Pas de téléphone ni de nom dans le résultat (référence du dossier seulement).
import { select } from "@/lib/server/db"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { OPEN_STATUSES, inFilter } from "@/lib/status"
import { buildWorklist, type Alert, type RuleLead } from "@/lib/follow-up-rules"

export interface Worklist { alerts: Alert[]; openLeads: number }

export async function loadWorklist(now: Date = new Date()): Promise<Worklist> {
  const leads = await selectRealLeads<Omit<RuleLead, "last_activity_at">>(`select=id,ref,status,created_at,assigned_to,next_follow_up_at&status=${inFilter(OPEN_STATUSES)}&anonymized_at=is.null&order=created_at.asc&limit=2000`)
  const staff = await select<{ user_id: string; active: boolean }>("landing_staff", "select=user_id,active&active=eq.true")
  const quoteIds = leads.filter((l) => l.status === "devis" || l.status === "negociation").map((l) => l.id)
  const last = new Map<string, string>()
  if (quoteIds.length) {
    const acts = await select<{ lead_id: string; created_at: string }>("landing_lead_activities", `select=lead_id,created_at&lead_id=in.(${quoteIds.join(",")})&order=created_at.desc&limit=5000`)
    for (const a of acts) if (!last.has(a.lead_id)) last.set(a.lead_id, a.created_at)
  }
  const rows: RuleLead[] = leads.map((l) => ({ ...l, assigned_to: l.assigned_to ?? null, next_follow_up_at: l.next_follow_up_at ?? null, last_activity_at: last.get(l.id) ?? null }))
  return { alerts: buildWorklist(rows, { now, activeStaffIds: new Set(staff.map((s) => s.user_id)) }), openLeads: leads.length }
}
