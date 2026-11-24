// Journal et relance des conversions envoyées à Meta (Lead, QualifiedLead, Purchase) — migration 0028.
//   • Chaque conversion est JOURNALISÉE avant l'envoi (état « pending »), puis son issue est notée (sent / failed / skipped).
//   • Une conversion échouée est RELANCÉE (jusqu'à 5 tentatives, délais croissants) tant que Meta l'accepte encore (7 jours) ; sans cela, une vente
//     non transmise ne l'est jamais (la date de réservation n'est posée qu'une fois).
//   • L'unicité (entreprise, réseau, identifiant d'évènement) interdit d'envoyer deux fois le même évènement.
//   • AUCUNE donnée personnelle dans le journal ; la charge utile est reconstruite à la relance depuis le lead (jamais pour un lead de test, sans
//     consentement de suivi, ni anonymisé).
//   • AVANT la migration : aucun journal, comportement historique (un envoi, pas de relance) — jamais d'erreur.
import { DbError, insertQuiet, select, update } from "./db"
import { sendMetaEvent, type ServerEvent } from "./meta"
import { SITE_URL } from "../config"

export type ConversionName = "Lead" | "QualifiedLead" | "Purchase"
export const MAX_ATTEMPTS = 5
/** Délai avant la tentative suivante, selon le nombre de tentatives déjà faites (minutes). */
export const RETRY_DELAYS_MIN = [15, 60, 360, 1440] as const
/** Meta refuse les évènements de plus de 7 jours : marge d'une heure. */
export const META_MAX_AGE_S = 7 * 86_400 - 3_600
const STALE_PENDING_MS = 10 * 60 * 1000

export interface ConversionLead {
  id: string
  product: string
  offer: string | null
  phone: string | null
  first_name: string
  visitor_id?: string | null
  ip?: string | null
  user_agent?: string | null
  fbp?: string | null
  fbc?: string | null
  landing_page?: string | null
  booking_value?: number | string | null
  tracking_consent: boolean
  is_test?: boolean | null
  anonymized_at?: string | null
}

/** Évènement Meta d'un lead : source UNIQUE de la charge utile (premier envoi et relance). */
export function buildConversionEvent(lead: ConversionLead, name: ConversionName, o: { eventId: string; eventTime?: number; value?: number }): ServerEvent {
  const user = {
    visitorId: lead.visitor_id ?? undefined,
    phone: lead.phone ?? undefined,
    firstName: lead.first_name,
    ip: lead.ip ?? undefined,
    userAgent: lead.user_agent ?? undefined,
    fbp: lead.fbp ?? undefined,
    fbc: lead.fbc ?? undefined,
  }
  const base = { eventName: name, eventId: o.eventId, eventTime: o.eventTime, user }
  if (name === "QualifiedLead") {
    // évènement personnalisé : aucune valeur monétaire
    return { ...base, actionSource: "chat", customData: { product: lead.product, content_category: lead.product, content_name: lead.offer || lead.product } }
  }
  if (name === "Purchase") {
    return {
      ...base,
      actionSource: "chat",
      customData: { product: lead.product, content_category: lead.product, content_name: lead.offer || lead.product, content_ids: lead.offer || lead.product, value: o.value ?? (Number.isFinite(Number(lead.booking_value)) ? Number(lead.booking_value) : 0), currency: "TND" },
    }
  }
  return {
    ...base,
    pageUrl: lead.landing_page ? `${SITE_URL.replace(/\/$/, "")}${lead.landing_page}` : undefined,
    customData: { product: lead.product, content_category: lead.product, content_name: lead.offer || lead.product, content_ids: lead.offer || lead.product, currency: "TND", value: 1 },
  }
}

type Outcome = { ok: boolean; skipped?: boolean; error?: unknown }

/** Raison technique courte et SANS donnée personnelle (message de Meta ou nom de l'erreur, jamais le corps de la requête). */
export function safeError(error: unknown): string {
  const e = error as { error?: { message?: unknown; code?: unknown; type?: unknown }; message?: unknown } | string | null | undefined
  const parts: string[] = []
  if (typeof e === "string") parts.push(e)
  else if (e && typeof e === "object") {
    if (e.error && typeof e.error === "object") for (const v of [e.error.type, e.error.code, e.error.message]) if (typeof v === "string" || typeof v === "number") parts.push(String(v))
    if (!parts.length && typeof e.message === "string") parts.push(e.message)
  }
  return (parts.join(" · ") || "échec d'envoi").replace(/\s+/g, " ").slice(0, 200)
}

const nextRetry = (attempts: number, now: number): string | null => (attempts >= MAX_ATTEMPTS ? null : new Date(now + RETRY_DELAYS_MIN[Math.min(attempts - 1, RETRY_DELAYS_MIN.length - 1)] * 60_000).toISOString())

export function outcomePatch(r: Outcome, attempts: number, now = Date.now()): Record<string, unknown> {
  if (r.ok) return { status: "sent", attempts, sent_at: new Date(now).toISOString(), last_error: null, next_retry_at: null }
  if (r.skipped) return { status: "skipped", attempts, last_error: "Meta non configuré", next_retry_at: null }
  return { status: "failed", attempts, last_error: safeError(r.error), next_retry_at: nextRetry(attempts, now) }
}

async function startLog(leadId: string, name: ConversionName, eventId: string, eventTime: number, valueTnd?: number): Promise<"ok" | "duplicate" | "unavailable"> {
  try {
    await insertQuiet("landing_conversion_log", { lead_id: leadId, network: "meta", event_name: name, event_id: eventId, event_time: eventTime, value_tnd: valueTnd ?? null, status: "pending", attempts: 0 })
    return "ok"
  } catch (e) {
    if (e instanceof DbError && e.isUniqueViolation) return "duplicate" // déjà journalisé : la relance s'en charge, on n'envoie pas deux fois
    return "unavailable" // table absente (migration non appliquée) ou base indisponible : comportement historique
  }
}

async function finishLog(eventId: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await update("landing_conversion_log", `network=eq.meta&event_id=eq.${encodeURIComponent(eventId)}`, patch)
  } catch {
    console.error("[conversions] état non enregistré")
  }
}

/** Purchase RETENU : journalisé à l'état « skipped » avec la raison « doublon:… », JAMAIS envoyé. Se libère seulement par une décision humaine (voir releaseHeldPurchase). */
export async function holdPurchase(leadId: string, valueTnd: number, reason: string): Promise<void> {
  try {
    await insertQuiet("landing_conversion_log", { lead_id: leadId, network: "meta", event_name: "Purchase", event_id: `purchase-${leadId}`, event_time: Math.floor(Date.now() / 1000), value_tnd: valueTnd, status: "skipped", attempts: 0, last_error: `doublon:${reason}`.slice(0, 200), next_retry_at: null })
  } catch {
    console.error("[conversions] Purchase retenu non journalisé") // déjà journalisé (unicité) ou table absente : rien n'est envoyé dans tous les cas
  }
}

/** Libère un Purchase retenu après REJET du signalement (réservation distincte) : il repart par la relance habituelle. Un Purchase déjà envoyé n'est jamais renvoyé. */
export async function releaseHeldPurchase(leadId: string): Promise<boolean> {
  try {
    const rows = await select<{ event_id: string }>("landing_conversion_log", `select=event_id&network=eq.meta&event_name=eq.Purchase&event_id=eq.purchase-${leadId}&status=eq.skipped&last_error=like.doublon:*&limit=1`)
    if (!rows[0]) return false
    await update("landing_conversion_log", `network=eq.meta&event_id=eq.${encodeURIComponent(rows[0].event_id)}`, { status: "failed", attempts: 0, last_error: "libéré après décision humaine", next_retry_at: new Date().toISOString() })
    return true
  } catch {
    return false
  }
}

/** Envoie une conversion à Meta en la journalisant. Ne lève jamais d'erreur. */
export async function sendMetaLogged(event: ServerEvent, ctx: { leadId: string | null; valueTnd?: number }): Promise<Outcome> {
  const eventTime = event.eventTime ?? Math.floor(Date.now() / 1000)
  const name = event.eventName as ConversionName
  let state: "ok" | "duplicate" | "unavailable" = "unavailable"
  if (ctx.leadId && (name === "Lead" || name === "QualifiedLead" || name === "Purchase")) state = await startLog(ctx.leadId, name, event.eventId, eventTime, ctx.valueTnd)
  if (state === "duplicate") return { ok: false, skipped: true }
  let r: Outcome
  try {
    r = await sendMetaEvent({ ...event, eventTime })
  } catch (error) {
    r = { ok: false, error }
  }
  if (state === "ok") await finishLog(event.eventId, outcomePatch(r, 1))
  return r
}

interface LogRow { id: number; lead_id: string | null; event_name: ConversionName; event_id: string; event_time: number; value_tnd: number | string | null; status: string; attempts: number; next_retry_at: string | null; created_at: string }
export interface RetryResult { examined: number; sent: number; failed: number; skipped: number; expired: number }

/** Relance les conversions échouées (ou restées « pending » après un arrêt brutal). Les filtres sont aussi appliqués ici (défense en profondeur). */
export async function retryConversions(now = Date.now()): Promise<RetryResult> {
  const out: RetryResult = { examined: 0, sent: 0, failed: 0, skipped: 0, expired: 0 }
  let rows: LogRow[]
  try {
    rows = await select<LogRow>("landing_conversion_log", "select=id,lead_id,event_name,event_id,event_time,value_tnd,status,attempts,next_retry_at,created_at&status=in.(pending,failed)&order=id.asc&limit=200")
  } catch {
    return out // table absente (migration non appliquée) : rien à relancer
  }
  const due = rows.filter((r) => {
    if (r.status !== "pending" && r.status !== "failed") return false
    if (r.attempts >= MAX_ATTEMPTS) return false
    if (r.status === "pending") return now - Date.parse(r.created_at) >= STALE_PENDING_MS
    return r.next_retry_at === null || Date.parse(r.next_retry_at) <= now
  }).slice(0, 50)
  const ids = Array.from(new Set(due.map((r) => r.lead_id).filter((x): x is string => !!x)))
  let leads: ConversionLead[] = []
  if (ids.length) {
    try {
      leads = await select<ConversionLead>("landing_leads", `select=id,product,offer,phone,first_name,visitor_id,ip,user_agent,fbp,fbc,landing_page,booking_value,tracking_consent,is_test,anonymized_at&id=in.(${ids.join(",")})&limit=200`)
    } catch {
      return out
    }
  }
  const byId = new Map(leads.map((l) => [l.id, l]))
  // Doublons CONFIRMÉS : jamais de conversion pour eux (colonne absente avant la migration 0030 : aucun doublon confirmé)
  let confirmedDuplicates = new Set<string>()
  if (ids.length) {
    try {
      confirmedDuplicates = new Set((await select<{ id: string; duplicate_of?: string | null }>("landing_leads", `select=id,duplicate_of&id=in.(${ids.join(",")})`)).filter((d) => d.duplicate_of).map((d) => d.id))
    } catch {
      confirmedDuplicates = new Set()
    }
  }
  for (const row of due) {
    out.examined++
    const lead = row.lead_id ? byId.get(row.lead_id) : undefined
    const attempts = row.attempts + 1
    if (lead && confirmedDuplicates.has(lead.id)) {
      await finishLog(row.event_id, { status: "skipped", attempts: row.attempts, last_error: "doublon confirmé : jamais envoyé", next_retry_at: null })
      out.skipped++
      continue
    }
    if (!lead || lead.is_test === true || !lead.tracking_consent || lead.anonymized_at) {
      await finishLog(row.event_id, { status: "skipped", attempts: row.attempts, last_error: !lead ? "lead introuvable" : lead.is_test ? "lead de test" : lead.anonymized_at ? "lead anonymisé" : "sans consentement de suivi", next_retry_at: null })
      out.skipped++
      continue
    }
    if (Math.floor(now / 1000) - Number(row.event_time) > META_MAX_AGE_S) {
      await finishLog(row.event_id, { status: "expired", attempts: row.attempts, last_error: "plus de 7 jours : refusé par Meta", next_retry_at: null })
      out.expired++
      continue
    }
    const value = row.value_tnd === null ? undefined : Number(row.value_tnd)
    const event = buildConversionEvent(lead, row.event_name, { eventId: row.event_id, eventTime: Number(row.event_time), value })
    let r: Outcome
    try {
      r = await sendMetaEvent(event)
    } catch (error) {
      r = { ok: false, error }
    }
    await finishLog(row.event_id, outcomePatch(r, attempts, now))
    if (r.ok) out.sent++
    else if (r.skipped) out.skipped++
    else out.failed++
  }
  return out
}

export interface ConversionStats { failed: number; abandoned: number; pending: number }

/** Comptages pour la page « Qualité des données » ; null si le journal n'existe pas encore. */
export async function conversionStats(): Promise<ConversionStats | null> {
  try {
    const rows = await select<{ status: string; attempts: number }>("landing_conversion_log", "select=status,attempts&status=in.(pending,failed,expired)&limit=5000")
    const failed = rows.filter((r) => r.status === "failed" && r.attempts < MAX_ATTEMPTS).length
    const abandoned = rows.filter((r) => r.status === "expired" || (r.status === "failed" && r.attempts >= MAX_ATTEMPTS)).length
    return { failed, abandoned, pending: rows.filter((r) => r.status === "pending").length }
  } catch {
    return null
  }
}
