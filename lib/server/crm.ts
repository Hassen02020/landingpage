// Logique du mini-CRM (serveur) : lecture des leads, statuts, historique, saisie manuelle.
// Toutes les écritures passent ici et laissent une trace dans landing_lead_activities.
import { insertOne, insertQuiet, select, update } from "./db"
import { CONTACT_CHANNELS, isRegion, type ContactChannel } from "@/lib/regions"
import { cleanEmail } from "@/lib/validation"
import { normalizePhone, randomRef } from "./hash"
import { sendMetaEvent } from "./meta"
import { sendTikTokEvent } from "./tiktok"
import { isProduct, type Product } from "../config"

export const STATUSES = ["nouveau", "contacte", "qualifie", "reserve", "perdu"] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABELS: Record<Status, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  reserve: "Réservé",
  perdu: "Perdu",
}
export const SOURCES = ["form", "whatsapp", "phone", "manual"] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABELS: Record<Source, string> = { form: "Formulaire", whatsapp: "WhatsApp", phone: "Téléphone", manual: "Saisie manuelle" }

/** Date du jour à Tunis (AAAA-MM-JJ), identique à la colonne générée `lead_day`. */
export function tunisDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(date)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v)

export interface Actor {
  id: string | null // landing_staff.user_id, null pour le système ou l'API
  label: string
}

export interface LeadRow {
  id: string
  created_at: string
  updated_at?: string
  ref: string
  visitor_ref: string | null
  first_name: string
  last_name: string | null
  phone: string | null
  product: Product
  offer: string | null
  niche: string | null
  destination: string | null
  travel_date: string | null
  travel_period: string | null
  adults: number | null // null = non précisé (migration 0006)
  children: number | null
  email?: string | null
  region?: string | null
  contact_channel?: ContactChannel
  budget: string | null
  message: string | null
  status: Status
  booking_value: number | null
  booked_at: string | null
  notes: string | null
  source?: Source
  assigned_to?: string | null
  next_follow_up_at?: string | null
  marketing_consent: boolean
  marketing_withdrawn_at?: string | null
  tracking_consent: boolean
  anonymized_at?: string | null
  channel: string | null
  utm_source: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term?: string | null
  adset_id?: string | null
  promo_code?: string | null // colonne ajoutée par 0003
  ad_id: string | null
  landing_page: string | null
  visitor_id: string | null
  fbp: string | null
  fbc: string | null
  ttp: string | null
  ttclid: string | null
  ip: string | null
  user_agent: string | null
}

export interface Activity {
  id: number
  created_at: string
  actor_label: string
  type: string
  from_status: Status | null
  to_status: Status | null
  body: string | null
}

export async function logActivity(
  leadId: string,
  actor: Actor,
  type: "created" | "status_change" | "note" | "assignment" | "follow_up" | "marketing_withdrawn",
  extra: { from_status?: Status; to_status?: Status; body?: string } = {}
): Promise<void> {
  await insertQuiet("landing_lead_activities", {
    lead_id: leadId,
    actor_id: actor.id,
    actor_label: actor.label.slice(0, 320),
    type,
    from_status: extra.from_status ?? null,
    to_status: extra.to_status ?? null,
    body: extra.body ? extra.body.slice(0, 2000) : null,
  })
}

export interface LeadFilters {
  status?: string
  product?: string
  channel?: string
  q?: string
  followUp?: string // "due" : relances échues (dossiers ouverts)
  assigned?: string // "me" | "none" | identifiant d'un membre
  open?: string // "1" : nouveaux, contactés et qualifiés seulement
  page?: number
  me?: string // identifiant du membre connecté (pour assigned=me)
}

export const PAGE_SIZE = 50

/** Liste filtrée. Les filtres sont validés : aucune valeur libre n'atteint la requête Supabase. */
export async function listLeads(f: LeadFilters): Promise<LeadRow[]> {
  const q = ["select=*", "order=created_at.desc", `limit=${PAGE_SIZE}`, `offset=${Math.max(0, (f.page ?? 0) * PAGE_SIZE)}`]
  if (isStatus(f.status)) q.push(`status=eq.${f.status}`)
  if (isProduct(f.product)) q.push(`product=eq.${f.product}`)
  if (f.channel && /^[a-z_]{1,32}$/.test(f.channel)) q.push(`channel=eq.${f.channel}`)
  if (f.followUp === "due") q.push(`next_follow_up_at=lte.${new Date().toISOString()}`, "status=in.(nouveau,contacte,qualifie)")
  if (f.open === "1" && f.followUp !== "due") q.push("status=in.(nouveau,contacte,qualifie)")
  if (f.assigned === "none") q.push("assigned_to=is.null")
  else if (f.assigned === "me" && f.me && UUID_RE.test(f.me)) q.push(`assigned_to=eq.${f.me}`)
  else if (f.assigned && UUID_RE.test(f.assigned)) q.push(`assigned_to=eq.${f.assigned}`)
  const term = (f.q || "").trim()
  if (term) {
    if (/^E2B-[A-Z0-9]{6}$/i.test(term)) q.push(`or=(ref.eq.${term.toUpperCase()},visitor_ref.eq.${term.toUpperCase()})`)
    else if (/^[+\d\s]{4,20}$/.test(term)) q.push(`phone=like.*${term.replace(/\D/g, "")}*`)
    else if (/^[A-Za-z\u00C0-\u00FF\u0600-\u06FF\s'-]{2,40}$/.test(term)) q.push(`or=(first_name.ilike.*${encodeURIComponent(term)}*,last_name.ilike.*${encodeURIComponent(term)}*)`)
    else return []
  }
  return select<LeadRow>("landing_leads", q.join("&"))
}

export async function getLead(id: string): Promise<LeadRow | null> {
  if (!UUID_RE.test(id)) return null
  const [lead] = await select<LeadRow>("landing_leads", `select=*&id=eq.${id}&limit=1`)
  return lead ?? null
}

export async function getLeadByRef(ref: string): Promise<LeadRow | null> {
  if (!/^E2B-[A-Z0-9]{6}$/.test(ref)) return null
  const [lead] = await select<LeadRow>("landing_leads", `select=*&ref=eq.${ref}&limit=1`)
  return lead ?? null
}

/** Autres leads du même téléphone (doublons possibles). */
export async function findDuplicates(lead: LeadRow): Promise<Pick<LeadRow, "id" | "ref" | "product" | "status" | "created_at" | "offer">[]> {
  if (!lead.phone || !/^\d{8,15}$/.test(lead.phone)) return []
  return select("landing_leads", `select=id,ref,product,status,created_at,offer&phone=eq.${lead.phone}&id=neq.${lead.id}&order=created_at.desc&limit=20`)
}

export async function getActivities(leadId: string): Promise<Activity[]> {
  if (!UUID_RE.test(leadId)) return []
  return select<Activity>("landing_lead_activities", `select=id,created_at,actor_label,type,from_status,to_status,body&lead_id=eq.${leadId}&order=created_at.desc&limit=200`)
}

export async function listStaff(): Promise<{ user_id: string; email: string; full_name: string | null }[]> {
  return select("landing_staff", "select=user_id,email,full_name&active=eq.true&order=email.asc")
}

export type StatusResult =
  | { ok: true; conversion: "envoyée" | "sans consentement" | null }
  | { ok: false; error: string }

/**
 * Change le statut d'un lead, trace l'action et, au passage à « réservé », envoie la
 * conversion Purchase / CompletePayment UNE seule fois (si le prospect a accepté les traceurs).
 */
export async function changeStatus(lead: LeadRow, status: Status, actor: Actor, opts: { bookingValue?: number; notes?: string } = {}): Promise<StatusResult> {
  if (lead.anonymized_at) return { ok: false, error: "Lead anonymisé : modification impossible" }
  if (opts.bookingValue !== undefined && (!Number.isFinite(opts.bookingValue) || opts.bookingValue < 0 || opts.bookingValue > 1e9)) {
    return { ok: false, error: "Montant invalide" }
  }
  if (status === "reserve" && opts.bookingValue === undefined && lead.booking_value === null) {
    return { ok: false, error: "Montant de la réservation obligatoire" }
  }

  const firstBooking = status === "reserve" && !lead.booked_at
  const patch: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() }
  if (opts.bookingValue !== undefined) patch.booking_value = opts.bookingValue
  if (opts.notes) patch.notes = opts.notes.slice(0, 2000)
  if (firstBooking) patch.booked_at = new Date().toISOString()

  await update("landing_leads", `id=eq.${lead.id}`, patch)
  if (lead.status !== status || opts.notes) {
    await logActivity(lead.id, actor, "status_change", {
      from_status: lead.status,
      to_status: status,
      body: [opts.bookingValue !== undefined ? `Montant : ${opts.bookingValue} TND` : null, opts.notes || null].filter(Boolean).join(" — ") || undefined,
    })
  }

  // booked_at n'est posé qu'une fois : la vente n'est jamais renvoyée (pas de double comptage)
  if (!firstBooking) return { ok: true, conversion: null }
  if (!lead.tracking_consent) return { ok: true, conversion: "sans consentement" }

  const value = opts.bookingValue ?? lead.booking_value ?? 0
  const event = {
    eventName: "Purchase",
    eventId: `purchase-${lead.id}`,
    actionSource: "chat" as const,
    customData: { product: lead.product, content_category: lead.product, content_name: lead.offer || lead.product, content_ids: lead.offer || lead.product, value, currency: "TND" },
    user: {
      visitorId: lead.visitor_id ?? undefined,
      phone: lead.phone ?? undefined,
      firstName: lead.first_name,
      ip: lead.ip ?? undefined,
      userAgent: lead.user_agent ?? undefined,
      fbp: lead.fbp ?? undefined,
      fbc: lead.fbc ?? undefined,
      ttp: lead.ttp ?? undefined,
      ttclid: lead.ttclid ?? undefined,
    },
  }
  await Promise.allSettled([sendMetaEvent(event), sendTikTokEvent(event)])
  return { ok: true, conversion: "envoyée" }
}

export type EditResult = { ok: true } | { ok: false; error: string }
const LOCKED: EditResult = { ok: false, error: "Lead anonymisé : modification impossible" }

export async function addNote(lead: LeadRow, body: string, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  const text = body.trim().slice(0, 2000)
  if (!text) return { ok: false, error: "Note vide" }
  await logActivity(lead.id, actor, "note", { body: text })
  return { ok: true }
}

export async function setFollowUp(lead: LeadRow, isoDate: string | null, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  const when = isoDate && !Number.isNaN(Date.parse(isoDate)) ? new Date(isoDate).toISOString() : null
  await update("landing_leads", `id=eq.${lead.id}`, { next_follow_up_at: when })
  await logActivity(lead.id, actor, "follow_up", { body: when ? `Relance prévue le ${when.slice(0, 16).replace("T", " ")} (UTC)` : "Relance supprimée" })
  return { ok: true }
}

export interface QualificationInput {
  region?: string
  email?: string
  budget?: string
  adults?: string
  children?: string
  travel_period?: string
  contact_channel?: string
}

/**
 * Qualification commerciale : données demandées PENDANT le suivi (pas au premier contact).
 * Le budget est une déclaration du prospect, jamais une dépense réelle. Champ vide = effacé.
 */
export async function qualifyLead(lead: LeadRow, input: QualificationInput, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  const patch: Record<string, unknown> = {}
  const changes: string[] = []
  const set = (col: keyof LeadRow & string, next: unknown, label: string, secret = false) => {
    const prev = (lead as unknown as Record<string, unknown>)[col] ?? null
    if (prev === next) return
    patch[col] = next
    changes.push(secret ? `${label} ${next === null ? "effacé" : "renseigné"}` : `${label} : ${next === null ? "—" : String(next)}`)
  }
  if (input.region !== undefined) {
    const r = input.region.trim()
    if (r && !isRegion(r)) return { ok: false, error: "Région inconnue" }
    set("region", r || null, "Région")
  }
  if (input.email !== undefined) {
    const raw = input.email.trim()
    const e = raw ? cleanEmail(raw) : null
    if (raw && !e) return { ok: false, error: "Adresse e-mail invalide" }
    set("email", e, "E-mail", true)
  }
  if (input.budget !== undefined) {
    const b = input.budget.trim().slice(0, 64)
    set("budget", b || null, "Budget déclaré")
  }
  if (input.travel_period !== undefined) set("travel_period", input.travel_period.trim().slice(0, 64) || null, "Période souhaitée")
  for (const [col, label, min, max] of [["adults", "Adultes", 1, 50], ["children", "Enfants", 0, 20]] as const) {
    const raw = input[col]
    if (raw === undefined) continue
    if (raw.trim() === "") set(col, null, label)
    else {
      const n = parseInt(raw, 10)
      if (!Number.isInteger(n) || n < min || n > max) return { ok: false, error: `${label} : nombre entre ${min} et ${max}` }
      set(col, n, label)
    }
  }
  if (input.contact_channel !== undefined) {
    if (!(CONTACT_CHANNELS as readonly string[]).includes(input.contact_channel)) return { ok: false, error: "Canal de contact inconnu" }
    set("contact_channel", input.contact_channel as ContactChannel, "Canal préféré")
  }
  if (!changes.length) return { ok: true }
  await update("landing_leads", `id=eq.${lead.id}`, patch)
  await logActivity(lead.id, actor, "note", { body: `Qualification — ${changes.join(" ; ")}` })
  return { ok: true }
}

export async function assignLead(lead: LeadRow, userId: string | null, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  if (userId !== null && !UUID_RE.test(userId)) return { ok: false, error: "Responsable invalide" }
  await update("landing_leads", `id=eq.${lead.id}`, { assigned_to: userId })
  await logActivity(lead.id, actor, "assignment", { body: userId ? `Assigné à ${userId}` : "Désassigné" })
  return { ok: true }
}

export async function withdrawMarketing(lead: LeadRow, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  await update("landing_leads", `id=eq.${lead.id}`, { marketing_consent: false, marketing_withdrawn_at: new Date().toISOString() })
  await logActivity(lead.id, actor, "marketing_withdrawn", { body: "Retrait du consentement marketing" })
  return { ok: true }
}

export interface ManualLeadInput {
  name: string
  phone: string
  product: string
  source: string
  offer?: string
  destination?: string
  message?: string
}

/** Saisie manuelle d'un lead arrivé par WhatsApp ou téléphone (sans formulaire). */
export async function createManualLead(input: ManualLeadInput, actor: Actor): Promise<{ ok: true; id: string; ref: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  const phone = normalizePhone(input.phone)
  if (name.length < 2 || name.length > 200) return { ok: false, error: "Nom requis" }
  if (!phone) return { ok: false, error: "Téléphone invalide" }
  if (!isProduct(input.product)) return { ok: false, error: "Produit invalide" }
  if (!(SOURCES as readonly string[]).includes(input.source) || input.source === "form") return { ok: false, error: "Source invalide" }
  const [firstName, ...rest] = name.split(/\s+/)

  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = randomRef()
    try {
      const row = await insertOne<{ id: string; ref: string }>("landing_leads", {
        ref,
        idempotency_key: crypto.randomUUID(),
        first_name: firstName.slice(0, 100),
        last_name: rest.join(" ").slice(0, 100) || null,
        phone,
        product: input.product,
        source: input.source,
        offer: input.offer?.trim().slice(0, 255) || null,
        destination: input.destination?.trim().slice(0, 128) || null,
        message: input.message?.trim().slice(0, 1000) || null,
        // le prospect nous a lui-même contactés au sujet de sa demande
        contact_consent: true,
        marketing_consent: false,
        tracking_consent: false,
        assigned_to: actor.id,
      })
      await logActivity(row.id, actor, "created", { body: `Saisie manuelle (${SOURCE_LABELS[input.source as Source]})` })
      return { ok: true, id: row.id, ref: row.ref }
    } catch (e) {
      const err = e as { isUniqueViolation?: boolean }
      if (!err.isUniqueViolation) return { ok: false, error: "Enregistrement impossible" }
      // même téléphone + produit aujourd'hui → doublon réel ; sinon collision de référence → nouvel essai
      const dup = await select<{ id: string; ref: string }>("landing_leads", `select=id,ref&phone=eq.${phone}&product=eq.${input.product}&lead_day=eq.${tunisDay()}&limit=1`)
      if (dup[0]) return { ok: false, error: `Ce prospect a déjà une demande aujourd'hui pour ce produit (${dup[0].ref})` }
    }
  }
  return { ok: false, error: "Enregistrement impossible" }
}
