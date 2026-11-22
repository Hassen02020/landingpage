// Conversations (étape 1 du chantier Growth & Marketing Intelligence) — règles PURES, partagées serveur / navigateur / tests.
// Une conversation n'est pas un prospect ; un prospect n'est pas une vente. Un lot anonyme ne crée ni fiche ni vente.
// Aucune donnée personnelle ici : le téléphone reste dans la fiche du lead.
import { isBooking, isStatus, type Status } from "@/lib/status"

export const CHANNELS = ["whatsapp", "messenger", "instagram", "facebook_commentaire", "telephone", "autre"] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram", facebook_commentaire: "Commentaire Facebook", telephone: "Téléphone", autre: "Autre",
}
export const ORIGINS = ["annonce", "organique", "direct", "inconnue"] as const
export type Origin = (typeof ORIGINS)[number]
export const ORIGIN_LABELS: Record<Origin, string> = { annonce: "Annonce", organique: "Organique", direct: "Direct", inconnue: "Inconnue" }
export const KINDS = ["individuelle", "lot"] as const
export type Kind = (typeof KINDS)[number]
export const CONV_STATUSES = ["ouverte", "sans_suite", "annulee"] as const
export type ConvStatus = (typeof CONV_STATUSES)[number]
export const CONV_STATUS_LABELS: Record<ConvStatus, string> = { ouverte: "Ouverte", sans_suite: "Sans suite", annulee: "Annulée" }

/** Nouvelle conversation après 30 jours sans échange (décision du propriétaire, 22/11/2026). */
export const NEW_CONVERSATION_AFTER_DAYS = 30
export const MAX_LOT = 1000

export const isChannel = (v: unknown): v is Channel => typeof v === "string" && (CHANNELS as readonly string[]).includes(v)
export const isOrigin = (v: unknown): v is Origin => typeof v === "string" && (ORIGINS as readonly string[]).includes(v)

export interface LotInput { channel: string; origin: string; campaign?: string; count: string | number; day?: string }
export interface IndividualInput { channel: string; origin: string; campaign?: string; leadId?: string }
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> }

const clean = (v: unknown, max: number): string | null => { const s = String(v ?? "").trim().slice(0, max); return s || null }
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface LotRow { kind: "lot"; channel: Channel; origin: Origin; campaign: string | null; conversation_count: number; started_at: string; last_activity_at: string }
export interface IndividualRow { kind: "individuelle"; channel: Channel; origin: Origin; campaign: string | null; conversation_count: 1; lead_id: string | null }

/** Heure de midi (Tunis, UTC+1 sans changement d'heure) du jour saisi : un lot est daté du JOUR, jamais d'une heure inventée. */
const dayToIso = (day: string): string => `${day}T12:00:00.000Z`

export function validateLot(input: LotInput, now: Date = new Date()): Validated<LotRow> {
  const errors: Record<string, string> = {}
  if (!isChannel(input.channel)) errors.channel = "Choisissez un canal."
  if (!isOrigin(input.origin)) errors.origin = "Choisissez une origine."
  const n = Number(String(input.count ?? "").trim())
  if (!Number.isInteger(n) || n < 1 || n > MAX_LOT) errors.count = `Nombre entier entre 1 et ${MAX_LOT}.`
  const day = String(input.day ?? "").trim() || now.toISOString().slice(0, 10)
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(day))) errors.day = "Date invalide."
  else if (Date.parse(dayToIso(day)) > now.getTime() + 24 * 3600 * 1000) errors.day = "La date ne peut pas être dans le futur."
  else if (Date.parse(dayToIso(day)) < now.getTime() - 400 * 24 * 3600 * 1000) errors.day = "Date trop ancienne (400 jours maximum)."
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { kind: "lot", channel: input.channel as Channel, origin: input.origin as Origin, campaign: clean(input.campaign, 255), conversation_count: n, started_at: dayToIso(day), last_activity_at: dayToIso(day) } }
}

export function validateIndividual(input: IndividualInput): Validated<IndividualRow> {
  const errors: Record<string, string> = {}
  if (!isChannel(input.channel)) errors.channel = "Choisissez un canal."
  if (!isOrigin(input.origin)) errors.origin = "Choisissez une origine."
  const leadId = String(input.leadId ?? "").trim()
  if (leadId && !UUID_RE.test(leadId)) errors.leadId = "Dossier invalide."
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { kind: "individuelle", channel: input.channel as Channel, origin: input.origin as Origin, campaign: clean(input.campaign, 255), conversation_count: 1, lead_id: leadId || null } }
}

/** Faut-il ouvrir une NOUVELLE conversation ? Oui si le dernier échange date de plus de 30 jours. */
export function needsNewConversation(lastActivityIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastActivityIso) return true
  const t = Date.parse(lastActivityIso)
  if (Number.isNaN(t)) return true
  return now.getTime() - t > NEW_CONVERSATION_AFTER_DAYS * 24 * 3600 * 1000
}

export type Stage = "conversation" | "prospect" | "qualifie" | "devis" | "vendu" | "perdu"
export const STAGE_LABELS: Record<Stage, string> = { conversation: "Conversation seule", prospect: "Prospect", qualifie: "Qualifié", devis: "Devis", vendu: "Vendu", perdu: "Perdu" }

/** Étape DÉDUITE (jamais stockée). Un lot ou une conversation sans fiche reste « conversation seule » : jamais de prospect ni de vente fictifs. */
export function deriveStage(leadStatus: string | null | undefined): Stage {
  if (!leadStatus || !isStatus(leadStatus)) return "conversation"
  const s: Status = leadStatus
  if (isBooking(s)) return "vendu"
  if (s === "perdu") return "perdu"
  if (s === "devis" || s === "negociation") return "devis"
  if (s === "qualifie") return "qualifie"
  return "prospect"
}

export interface ConvForStats { kind: string; status: string; conversation_count: number; lead_status?: string | null; has_lead: boolean }
export interface ConvStats { conversations: number; prospects: number; qualifies: number; ventes: number; conversationSeule: number }

/** Compteurs par étape. Les conversations ANNULÉES sont exclues ; un lot ne compte que des conversations. */
export function summarize(rows: ConvForStats[]): ConvStats {
  const out: ConvStats = { conversations: 0, prospects: 0, qualifies: 0, ventes: 0, conversationSeule: 0 }
  for (const r of rows) {
    if (r.status === "annulee") continue
    out.conversations += Math.max(0, r.conversation_count)
    if (r.kind !== "individuelle" || !r.has_lead) { out.conversationSeule += Math.max(0, r.conversation_count); continue }
    const stage = deriveStage(r.lead_status)
    if (stage === "conversation") { out.conversationSeule += 1; continue }
    out.prospects += 1
    if (stage === "qualifie" || stage === "devis" || stage === "vendu") out.qualifies += 1
    if (stage === "vendu") out.ventes += 1
  }
  return out
}

export const rate = (num: number, den: number, minSample = 5): number | null => (den >= minSample ? Math.round((num / den) * 1000) / 10 : null)
