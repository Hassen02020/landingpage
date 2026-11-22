// Conversations (table landing_conversations, migration 0029). Cloisonnement par entreprise assuré par lib/server/db.ts.
// AUCUN téléphone, nom ni texte n'est lu ni écrit ici : le numéro reste dans la fiche du lead.
import { DbError, insertOne, insertQuiet, select, update } from "@/lib/server/db"
import { getLead } from "@/lib/server/crm"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { canModifyLead, type OrgRole } from "@/lib/permissions"
import { deriveStage, summarize, validateIndividual, validateLot, type ConvForStats, type ConvStats, type IndividualInput, type LotInput, type Stage } from "@/lib/conversations"

export interface ConversationView {
  id: number; kind: "individuelle" | "lot"; channel: string; origin: string; campaign: string | null; conversation_count: number
  lead_id: string | null; status: string; started_at: string; created_by: string | null; stage: Stage; anonymized_at: string | null
}
export interface ConvActor { id: string; label: string; role: OrgRole }
export type ConvResult = { ok: true } | { ok: false; errors: Record<string, string>; message?: string }

const missing = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)
const MIGRATION_MSG = "La migration 0029 n'est pas encore appliquée dans Supabase."
const COLS = "id,kind,channel,origin,campaign,conversation_count,lead_id,status,started_at,created_by,anonymized_at"

async function log(actor: ConvActor, summary: string) {
  // Journal d'audit : jamais de donnée personnelle (ni numéro ni nom), seulement l'action et l'identifiant de la conversation.
  await insertQuiet("landing_admin_log", { actor_id: actor.id, actor_label: actor.label.slice(0, 320), area: "conversations", summary: summary.slice(0, 300) }).catch(() => console.error("[conversations] journal non écrit"))
}

/** Liste (sans numéro). Les statuts des fiches reliées sont lus pour DÉDUIRE l'étape ; aucune autre donnée de la fiche n'est renvoyée. */
export async function listConversations(opts: { days?: number } = {}): Promise<{ rows: ConversationView[]; stats: ConvStats; tableMissing: boolean }> {
  const days = Math.min(Math.max(opts.days ?? 30, 1), 400)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
  try {
    const raw = await select<Omit<ConversationView, "stage">>("landing_conversations", `select=${COLS}&started_at=gte.${since}&is_test=eq.false&order=started_at.desc&limit=500`)
    const ids = Array.from(new Set(raw.map((r) => r.lead_id).filter((x): x is string => Boolean(x))))
    const statusById = new Map<string, string>()
    if (ids.length) {
      const leads = await selectRealLeads<{ id: string; status: string }>(`select=id,status&id=in.(${ids.join(",")})`)
      for (const l of leads) statusById.set(l.id, l.status)
    }
    const rows: ConversationView[] = raw.map((r) => ({ ...r, stage: r.kind === "individuelle" && r.lead_id ? deriveStage(statusById.get(r.lead_id)) : "conversation" }))
    const forStats: ConvForStats[] = raw.map((r) => ({ kind: r.kind, status: r.status, conversation_count: r.conversation_count, has_lead: Boolean(r.lead_id), lead_status: r.lead_id ? statusById.get(r.lead_id) ?? null : null }))
    return { rows, stats: summarize(forStats), tableMissing: false }
  } catch (e) {
    if (missing(e)) return { rows: [], stats: summarize([]), tableMissing: true }
    throw e
  }
}

/** Lot du jour : donnée agrégée, sans identité. Tout conseiller actif de l'entreprise peut le saisir. */
export async function createLot(actor: ConvActor, input: LotInput): Promise<ConvResult> {
  const v = validateLot(input)
  if (!v.ok) return { ok: false, errors: v.errors }
  try {
    const row = await insertOne<{ id: number }>("landing_conversations", { ...v.value, source_kind: "saisie", created_by: actor.id, updated_by: actor.id })
    await log(actor, `Lot de ${v.value.conversation_count} conversation(s) saisi (${v.value.channel}) #${row?.id ?? "?"}`)
    return { ok: true }
  } catch (e) {
    if (missing(e)) return { ok: false, errors: {}, message: MIGRATION_MSG }
    console.error("[conversations] lot non enregistré", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}

/** Conversation individuelle. Si elle est reliée à une fiche, les droits sur CETTE fiche sont revérifiés ici (côté serveur). */
export async function createIndividual(actor: ConvActor, input: IndividualInput): Promise<ConvResult> {
  const v = validateIndividual(input)
  if (!v.ok) return { ok: false, errors: v.errors }
  if (v.value.lead_id) {
    const lead = await getLead(v.value.lead_id) // cloisonné par entreprise : une fiche d'une autre entreprise est introuvable
    if (!lead) return { ok: false, errors: { leadId: "Dossier introuvable." } }
    if (!canModifyLead(actor.role, actor.id, lead)) return { ok: false, errors: {}, message: "Ce dossier est affecté à un collègue : seul un manager ou un administrateur peut y ajouter une conversation." }
    if (lead.anonymized_at) return { ok: false, errors: {}, message: "Dossier anonymisé : modification impossible." }
  }
  try {
    const row = await insertOne<{ id: number }>("landing_conversations", { ...v.value, source_kind: "saisie", created_by: actor.id, updated_by: actor.id })
    await log(actor, `Conversation ${v.value.channel} saisie #${row?.id ?? "?"}${v.value.lead_id ? " (reliée à un dossier)" : ""}`)
    return { ok: true }
  } catch (e) {
    if (missing(e)) return { ok: false, errors: {}, message: MIGRATION_MSG }
    console.error("[conversations] conversation non enregistrée", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}

/** Correction : on ANNULE (la ligne reste, exclue des indicateurs). Jamais de suppression. */
export async function cancelConversation(actor: ConvActor, id: number): Promise<ConvResult> {
  if (!Number.isInteger(id) || id < 1) return { ok: false, errors: {}, message: "Conversation introuvable." }
  try {
    const [row] = await select<{ id: number; kind: string; lead_id: string | null; created_by: string | null; status: string }>("landing_conversations", `select=id,kind,lead_id,created_by,status&id=eq.${id}&limit=1`)
    if (!row) return { ok: false, errors: {}, message: "Conversation introuvable." }
    if (row.status === "annulee") return { ok: true }
    if (row.lead_id) {
      const lead = await getLead(row.lead_id)
      if (!lead || !canModifyLead(actor.role, actor.id, lead)) return { ok: false, errors: {}, message: "Vous ne pouvez pas modifier cette conversation." }
    } else if (!(actor.role === "admin" || actor.role === "manager" || row.created_by === actor.id)) {
      // Sans fiche (lot, conversation seule) : son auteur, ou un manager / administrateur.
      return { ok: false, errors: {}, message: "Seul son auteur, un manager ou un administrateur peut annuler cette saisie." }
    }
    await update("landing_conversations", `id=eq.${id}`, { status: "annulee", updated_by: actor.id, updated_at: new Date().toISOString() })
    await log(actor, `Conversation #${id} annulée`)
    return { ok: true }
  } catch (e) {
    if (missing(e)) return { ok: false, errors: {}, message: MIGRATION_MSG }
    console.error("[conversations] annulation impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Annulation impossible. Réessayez." }
  }
}
