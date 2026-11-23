// Doublons de dossiers : signaler → confirmer / rejeter → rouvrir. Cloisonnement par entreprise assuré par lib/server/db.ts ; droits revérifiés ICI à chaque appel.
// Jamais de fusion, de suppression ni de changement de statut du dossier : la relation de doublon est une donnée à part, tracée et réversible.
// Aucune donnée personnelle dans les traces : références de dossiers, règle, motif court.
import { DbError, insertOne, insertQuiet, select, update } from "@/lib/server/db"
import { getLead, logActivity, type LeadRow } from "@/lib/server/crm"
import { releaseHeldPurchase } from "@/lib/server/conversions"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { canDecideDuplicate, canFlagDuplicate, canReopenDuplicate, type OrgRole } from "@/lib/permissions"
import { canTransition, detectCandidates, hasValidPhone, type DupCandidate, type DupConfidence, type DupLead, type DupRule, type DupStatus, type PurchaseState } from "@/lib/duplicates"

export interface DupActor { id: string; label: string; role: OrgRole }
export interface DuplicateReview {
  id: number; lead_id: string; primary_lead_id: string; rule: DupRule; confidence: DupConfidence; status: DupStatus; reason: string | null
  reported_by: string; reported_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; purchase_state: PurchaseState | null
}
export type DupResult = { ok: true; message: string } | { ok: false; error: string }

const missingTable = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)
const MIGRATION_MSG = "La migration 0030 n'est pas encore appliquée dans Supabase : les doublons ne peuvent pas être signalés."
const REVIEW_COLS = "id,lead_id,primary_lead_id,rule,confidence,status,reason,reported_by,reported_at,decided_by,decided_at,decision_note,purchase_state"
const short = (s: unknown, max: number): string | null => { const t = String(s ?? "").trim().slice(0, max); return t || null }

async function auditLog(actor: DupActor, summary: string): Promise<void> {
  await insertQuiet("landing_admin_log", { actor_id: actor.id, actor_label: actor.label.slice(0, 320), area: "doublons", summary: summary.slice(0, 300) }).catch(() => console.error("[doublons] journal non écrit"))
}

/** Message sûr pour une erreur de la base : les règles de la base (déclencheurs) sont rédigées en français, sans donnée personnelle. */
function dbMessage(e: unknown): string {
  if (e instanceof DbError) {
    const m = e.pgMessage ?? ""
    if (/four_eyes/.test(m)) return "Vous ne pouvez pas décider votre propre signalement."
    if (/active_uq|duplicate key|unique/i.test(m) || e.isUniqueViolation) return "Ce dossier a déjà un signalement actif."
    if (/^(signalement|doublon) :/.test(m)) return m
  }
  return "Opération impossible. Réessayez."
}

const asDupLead = (l: Pick<LeadRow, "id" | "phone" | "product" | "offer" | "created_at" | "status"> & Partial<LeadRow>): DupLead => ({
  id: l.id, phone: l.phone, product: l.product, offer: l.offer, offer_id: (l as { offer_id?: string | null }).offer_id ?? null, travel_date: l.travel_date ?? null,
  created_at: l.created_at, status: l.status, is_test: l.is_test ?? null, anonymized_at: l.anonymized_at ?? null,
})

export interface CandidateView extends DupCandidate { otherId: string; otherRef: string; otherStatus: string }

/** Candidats de doublon d'un dossier (détectés par calcul : « non examinés » tant qu'ils ne sont pas signalés). Lecture seule. */
export async function candidatesFor(lead: LeadRow): Promise<CandidateView[]> {
  if (!hasValidPhone(lead.phone)) return []
  const others = await selectRealLeads<LeadRow>(`select=id,ref,phone,product,offer,offer_id,travel_date,created_at,status&phone=eq.${lead.phone}&id=neq.${lead.id}&limit=50`)
  const refOf = new Map(others.map((o) => [o.id, o]))
  return detectCandidates(asDupLead(lead), others.map(asDupLead)).map((c) => {
    const otherId = c.candidateId === lead.id ? c.primaryId : c.candidateId
    const o = refOf.get(otherId)
    return { ...c, otherId, otherRef: o?.ref ?? otherId.slice(0, 8), otherStatus: o?.status ?? "?" }
  })
}

/** Signalements qui concernent un dossier (comme candidat ou comme principal). Table absente : liste vide. */
export async function reviewsForLead(leadId: string): Promise<DuplicateReview[]> {
  try {
    return await select<DuplicateReview>("landing_duplicate_reviews", `select=${REVIEW_COLS}&or=(lead_id.eq.${leadId},primary_lead_id.eq.${leadId})&order=id.desc&limit=20`)
  } catch (e) {
    if (missingTable(e)) return []
    throw e
  }
}

export async function listReviews(status: DupStatus): Promise<{ reviews: (DuplicateReview & { leadRef: string; primaryRef: string })[]; tableMissing: boolean }> {
  try {
    const reviews = await select<DuplicateReview>("landing_duplicate_reviews", `select=${REVIEW_COLS}&status=eq.${status}&order=id.desc&limit=200`)
    const ids = Array.from(new Set(reviews.flatMap((r) => [r.lead_id, r.primary_lead_id])))
    const refs = new Map<string, string>()
    if (ids.length) for (const l of await select<{ id: string; ref: string }>("landing_leads", `select=id,ref&id=in.(${ids.join(",")})`)) refs.set(l.id, l.ref)
    return { reviews: reviews.map((r) => ({ ...r, leadRef: refs.get(r.lead_id) ?? "?", primaryRef: refs.get(r.primary_lead_id) ?? "?" })), tableMissing: false }
  } catch (e) {
    if (missingTable(e)) return { reviews: [], tableMissing: true }
    throw e
  }
}

/** Signaler un doublon potentiel. Conseiller (ses dossiers), Manager, Admin. Le dossier candidat est celui que l'on signale ; `primaryLeadId` le dossier principal. */
export async function flagDuplicate(actor: DupActor, input: { leadId: string; primaryLeadId: string; reason?: string }): Promise<DupResult> {
  if (input.leadId === input.primaryLeadId) return { ok: false, error: "Un dossier ne peut pas être son propre doublon." }
  const [lead, primary] = await Promise.all([getLead(input.leadId), getLead(input.primaryLeadId)]) // cloisonné : un dossier d'une autre entreprise est introuvable
  if (!lead || !primary) return { ok: false, error: "Dossier introuvable." }
  if (!canFlagDuplicate(actor.role, actor.id, lead)) return { ok: false, error: "Vous ne pouvez pas signaler un doublon sur ce dossier (affecté à un collègue)." }
  if (lead.anonymized_at || primary.anonymized_at) return { ok: false, error: "Dossier anonymisé : modification impossible." }
  if (!hasValidPhone(lead.phone) || lead.phone !== primary.phone) return { ok: false, error: "Les deux dossiers doivent avoir le même numéro de téléphone." }
  if (lead.duplicate_of || primary.duplicate_of) return { ok: false, error: "Un des dossiers est déjà confirmé comme doublon." }
  const detected = detectCandidates(asDupLead(lead), [asDupLead(primary)])[0]
  const rule: DupRule = detected?.rule ?? "manuel"
  const confidence: DupConfidence = detected?.confidence ?? "faible"
  try {
    await insertOne("landing_duplicate_reviews", { lead_id: lead.id, primary_lead_id: primary.id, rule, confidence, status: "signale", reason: short(input.reason, 200), reported_by: actor.id })
  } catch (e) {
    if (missingTable(e)) return { ok: false, error: MIGRATION_MSG }
    return { ok: false, error: dbMessage(e) }
  }
  await logActivity(lead.id, { id: actor.id, label: actor.label }, "duplicate_flagged", { body: `Doublon potentiel de ${primary.ref} (${rule}, confiance ${confidence})${short(input.reason, 200) ? ` — ${short(input.reason, 200)}` : ""}` }).catch(() => undefined)
  await auditLog(actor, `Doublon signalé : ${lead.ref} → ${primary.ref} (${rule})`)
  return { ok: true, message: `Signalé : ${lead.ref} est un doublon potentiel de ${primary.ref}. Un responsable doit confirmer ou rejeter.` }
}

async function loadReview(id: number): Promise<DuplicateReview | null> {
  if (!Number.isInteger(id) || id < 1) return null
  try {
    return (await select<DuplicateReview>("landing_duplicate_reviews", `select=${REVIEW_COLS}&id=eq.${id}&limit=1`))[0] ?? null
  } catch (e) {
    if (missingTable(e)) return null
    throw e
  }
}

/** État du Purchase du dossier candidat au moment de la décision (envoyé / retenu / aucun). Journal absent : « aucun ». */
async function purchaseStateOf(leadId: string): Promise<PurchaseState> {
  try {
    const r = (await select<{ status: string; last_error: string | null }>("landing_conversion_log", `select=status,last_error&network=eq.meta&event_name=eq.Purchase&event_id=eq.purchase-${leadId}&limit=1`))[0]
    if (!r) return "aucun"
    if (r.status === "sent") return "envoye"
    return "retenu"
  } catch {
    return "aucun"
  }
}

/** D6 : commissions et coûts rattachés au dossier doublon. Tables absentes : aucun. */
async function attachedFinancials(leadId: string): Promise<{ commissions: number; costs: number }> {
  const count = async (table: string): Promise<number> => {
    try { return (await select<{ id: number }>(table, `select=id&lead_id=eq.${leadId}&limit=50`)).length } catch { return 0 }
  }
  const [commissions, costs] = await Promise.all([count("landing_commissions"), count("landing_variable_costs")])
  return { commissions, costs }
}

/** Confirmer ou rejeter un signalement (Manager / Admin, jamais son propre signalement). Confirmer : bloqué si des commissions ou coûts sont attachés au doublon (D6). */
export async function decideDuplicate(actor: DupActor, reviewId: number, decision: "confirme" | "rejete", note?: string): Promise<DupResult> {
  const review = await loadReview(reviewId)
  if (!review) return { ok: false, error: "Signalement introuvable." }
  if (!canTransition(review.status, decision)) return { ok: false, error: "Ce signalement a déjà été décidé." }
  if (!canDecideDuplicate(actor.role, actor.id, review)) {
    return { ok: false, error: review.reported_by === actor.id ? "Vous ne pouvez pas décider votre propre signalement : un autre responsable doit le faire." : "Seuls les responsables et administrateurs peuvent confirmer ou rejeter un doublon." }
  }
  const [lead, primary] = await Promise.all([getLead(review.lead_id), getLead(review.primary_lead_id)])
  if (!lead || !primary) return { ok: false, error: "Dossier introuvable." }
  if (decision === "confirme") {
    const fin = await attachedFinancials(lead.id)
    if (fin.commissions + fin.costs > 0) {
      return { ok: false, error: `Confirmation impossible : ${fin.commissions} commission(s) et ${fin.costs} coût(s) sont rattachés au dossier ${lead.ref}. Rattachez-les au dossier principal ${primary.ref} avant de confirmer.` }
    }
  }
  const purchase_state = await purchaseStateOf(lead.id)
  const patch = { status: decision, decided_by: actor.id, decided_at: new Date().toISOString(), decision_note: short(note, 300), purchase_state }
  try {
    await update("landing_duplicate_reviews", `id=eq.${review.id}&status=eq.signale`, patch) // conditionnel : pas de double décision en cas de course
  } catch (e) {
    return { ok: false, error: dbMessage(e) }
  }
  const after = await loadReview(review.id)
  if (!after || after.status !== decision) return { ok: false, error: "Le signalement a été modifié entre-temps. Rechargez la page." }
  let released = false
  if (decision === "rejete" && purchase_state === "retenu") released = await releaseHeldPurchase(lead.id) // réservation distincte : le Purchase retenu repart
  await logActivity(lead.id, { id: actor.id, label: actor.label }, decision === "confirme" ? "duplicate_confirmed" : "duplicate_rejected", {
    body: `${decision === "confirme" ? "Doublon confirmé" : "Signalement rejeté"} (principal : ${primary.ref}) — Purchase : ${purchase_state}${released ? " (libéré)" : ""}${short(note, 300) ? ` — ${short(note, 300)}` : ""}`,
  }).catch(() => undefined)
  await auditLog(actor, `Doublon ${decision === "confirme" ? "confirmé" : "rejeté"} : ${lead.ref} → ${primary.ref} (Purchase ${purchase_state})`)
  const warn = decision === "confirme" && purchase_state === "envoye" ? " Attention : un Purchase avait déjà été envoyé à Meta pour ce dossier ; le CRM corrige ses chiffres, aucune correction n'est envoyée à Meta." : ""
  return { ok: true, message: `${decision === "confirme" ? "Doublon confirmé : le dossier n'est plus compté dans les ventes." : "Signalement rejeté : le dossier reste compté."}${warn}` }
}

/** Rouvrir une décision (administrateur seulement, D2) : le signalement redevient « signalé » ; une confirmation levée remet le dossier dans les chiffres. */
export async function reopenDuplicate(actor: DupActor, reviewId: number, note?: string): Promise<DupResult> {
  if (!canReopenDuplicate(actor.role)) return { ok: false, error: "Seul un administrateur peut rouvrir une décision de doublon." }
  const review = await loadReview(reviewId)
  if (!review) return { ok: false, error: "Signalement introuvable." }
  if (!canTransition(review.status, "signale")) return { ok: false, error: "Ce signalement n'est pas décidé." }
  const [lead, primary] = await Promise.all([getLead(review.lead_id), getLead(review.primary_lead_id)])
  try {
    await update("landing_duplicate_reviews", `id=eq.${review.id}&status=eq.${review.status}`, { status: "signale", decided_by: null, decided_at: null, decision_note: null })
  } catch (e) {
    return { ok: false, error: dbMessage(e) }
  }
  if (lead) await logActivity(lead.id, { id: actor.id, label: actor.label }, "duplicate_reopened", { body: `Décision rouverte (était : ${review.status})${short(note, 300) ? ` — ${short(note, 300)}` : ""}` }).catch(() => undefined)
  await auditLog(actor, `Décision de doublon rouverte : ${lead?.ref ?? "?"} → ${primary?.ref ?? "?"} (était ${review.status})`)
  return { ok: true, message: "Décision rouverte : le signalement est de nouveau à examiner." }
}
