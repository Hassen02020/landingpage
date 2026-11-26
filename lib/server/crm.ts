// Logique du mini-CRM (serveur) : lecture des leads, statuts, historique, saisie manuelle.
// Toutes les écritures passent ici et laissent une trace dans landing_lead_activities.
import { DbError, insertOne, insertQuiet, select, update } from "./db"
import { CONTACT_CHANNELS, isRegion, type ContactChannel } from "@/lib/regions"
import { cleanEmail } from "@/lib/validation"
import { buildConversationBody, checkNote } from "@/lib/conversation-themes"
import { describeAttachment, lookupConversation, parseWaRef } from "./whatsapp"
import { normalizePhone, randomRef } from "./hash"
import { buildConversionEvent, holdPurchase, sendMetaLogged } from "./conversions"
import { reservationConflicts } from "./reservation-guard"
import type { ReservationConflict } from "@/lib/duplicates"
import { sendTikTokEvent } from "./tiktok"
import { isProduct, type Product } from "../config"
import { isLossReason } from "@/lib/governance"

import { OPEN_STATUSES, STATUSES, STATUS_LABELS, inFilter, isBooking, isStatus, parseStatusList, type Status } from "@/lib/status"

// Source unique : lib/status.ts (ré-exportée ici pour les imports existants)
export { STATUSES, STATUS_LABELS, isStatus }
export type { Status }
export const SOURCES = ["form", "whatsapp", "phone", "manual"] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABELS: Record<Source, string> = { form: "Formulaire", whatsapp: "WhatsApp", phone: "Téléphone", manual: "Saisie manuelle" }

/** Date du jour à Tunis (AAAA-MM-JJ), identique à la colonne générée `lead_day`. */
export function tunisDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(date)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Actor {
  id: string | null // landing_staff.user_id, null pour le système ou l'API
  label: string
}

export interface LeadRow {
  custom_fields?: Record<string, string> | null // réponses aux champs personnalisés de l'entreprise (clés c1…c5)
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
  form_page?: string | null
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
  utm_medium?: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term?: string | null
  adset_id?: string | null
  promo_code?: string | null // colonne ajoutée par 0003
  /** gouvernance des données (migration 0026) : absentes tant qu'elle n'est pas appliquée */
  is_test?: boolean | null
  age_range?: string | null // migration 0027 (tranche d'âge déclarée)
  offer_id?: string | null // migration 0004 : identifiant de l'offre du catalogue, quand le formulaire le transmet
  duplicate_of?: string | null // migration 0030 : dossier principal, renseigné seulement quand le doublon est CONFIRMÉ
  duplicate_confirmed_at?: string | null
  lost_reason?: string | null
  purchased_product?: string | null
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
  type: "created" | "status_change" | "note" | "assignment" | "follow_up" | "marketing_withdrawn" | "wa_in" | "wa_out" | "duplicate_flagged" | "duplicate_confirmed" | "duplicate_rejected" | "duplicate_reopened",
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
  const wanted = parseStatusList(f.status) // « a,b » accepté (ex. À traiter = nouveau + à contacter)
  if (wanted.length === 1) q.push(`status=eq.${wanted[0]}`)
  else if (wanted.length > 1) q.push(`status=${inFilter(wanted)}`)
  if (isProduct(f.product)) q.push(`product=eq.${f.product}`)
  if (f.channel && /^[a-z_]{1,32}$/.test(f.channel)) q.push(`channel=eq.${f.channel}`)
  if (f.followUp === "due") q.push(`next_follow_up_at=lte.${new Date().toISOString()}`, `status=${inFilter(OPEN_STATUSES)}`)
  if (f.open === "1" && f.followUp !== "due" && !wanted.length) q.push(`status=${inFilter(OPEN_STATUSES)}`)
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
  | { ok: true; conversion: "envoyée" | "sans consentement" | "retenue" | null; /** évènement « lead qualifié » (première qualification seulement) */ qualified?: "envoyé" | "sans consentement" }
  | { ok: false; error: string; /** réservation possible en double : décision humaine requise */ code?: "duplicate_reservation"; conflicts?: ReservationConflict[] }

/** « Lead qualifié » : a atteint « qualifié » ou plus loin (même définition que l'entonnoir et la rentabilité). */
export const QUALIFIED_OR_BEYOND: readonly Status[] = ["qualifie", "devis", "negociation", "reserve", "gagne"]
const isQualifiedStage = (s: Status): boolean => QUALIFIED_OR_BEYOND.includes(s)

/**
 * Change le statut d'un lead, trace l'action et, au passage à « réservé », envoie la
 * conversion Purchase / CompletePayment UNE seule fois (si le prospect a accepté les traceurs).
 */
export async function changeStatus(lead: LeadRow, status: Status, actor: Actor, opts: { bookingValue?: number; notes?: string; lostReason?: string; purchasedProduct?: string; /** motif : « oui, c'est une réservation DISTINCTE d'un autre dossier » (décision humaine, tracée) */ distinctReservation?: string } = {}): Promise<StatusResult> {
  if (lead.anonymized_at) return { ok: false, error: "Lead anonymisé : modification impossible" }
  if (opts.bookingValue !== undefined && (!Number.isFinite(opts.bookingValue) || opts.bookingValue < 0 || opts.bookingValue > 1e9)) {
    return { ok: false, error: "Montant invalide" }
  }
  if (opts.lostReason && !isLossReason(opts.lostReason)) return { ok: false, error: "Motif de perte invalide" }
  if (opts.purchasedProduct && !isProduct(opts.purchasedProduct)) return { ok: false, error: "Produit acheté invalide" }
  // vente (réservé OU gagné) : montant obligatoire
  if (isBooking(status) && opts.bookingValue === undefined && lead.booking_value === null) {
    return { ok: false, error: "Montant de la réservation obligatoire" }
  }

  // La date de réservation n'est posée qu'UNE fois : réservé → gagné, ou un retour en arrière suivi
  // d'une nouvelle réservation, n'envoie jamais une seconde conversion Purchase.
  const firstBooking = isBooking(status) && !lead.booked_at

  // « Une réservation = une vente = un Purchase » : avant d'enregistrer la PREMIÈRE réservation d'un dossier, chercher un autre dossier du même client,
  // même produit, même offre/départ, déjà réservé ou portant un Purchase. S'il existe : l'enregistrement s'ARRÊTE tant qu'un humain n'a pas tranché
  // (« doublon » → signalement, ou « réservation distincte » avec motif). Si le contrôle ne peut pas s'exécuter : la réservation est enregistrée
  // mais le Purchase est RETENU (jamais d'envoi dans le doute).
  let holdReason: string | null = null
  let distinctOf: ReservationConflict[] = []
  if (firstBooking && lead.is_test !== true) {
    try {
      const conflicts = await reservationConflicts(lead)
      if (conflicts.length) {
        if (!opts.distinctReservation?.trim()) {
          const refs = conflicts.map((c) => c.ref ?? c.id.slice(0, 8)).join(", ")
          return { ok: false, code: "duplicate_reservation", conflicts, error: `Réservation possible en double : un autre dossier de ce client (${refs}) est déjà réservé pour la même offre. Signalez un doublon, ou confirmez « réservation distincte » avec un motif.` }
        }
        distinctOf = conflicts
      }
    } catch {
      holdReason = "controle_doublon_indisponible"
    }
  }
  const patch: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() }
  if (opts.bookingValue !== undefined) patch.booking_value = opts.bookingValue
  // Les notes commerciales sont PRÉSERVÉES : on ajoute à la note du dossier (jamais d'écrasement) ; l'historique garde de toute façon le texte complet.
  if (opts.notes) { const merged = [lead.notes, opts.notes].filter(Boolean).join("\n"); if (merged.length <= 2000) patch.notes = merged }
  if (firstBooking) patch.booked_at = new Date().toISOString()

  // « lead qualifié » : UNE seule fois par lead, à la première fois qu'il atteint « qualifié » (ou plus loin). Décidé AVANT d'écrire l'historique
  // du changement en cours. En cas de doute (lecture de l'historique impossible) on n'envoie rien : jamais de doublon.
  // Un lead marqué « test » ne nourrit JAMAIS les plateformes publicitaires (ni QualifiedLead, ni Purchase) : ce serait de fausses conversions.
  const adsEnabled = lead.is_test !== true
  let firstQualification = false
  if (adsEnabled && isQualifiedStage(status) && !isQualifiedStage(lead.status)) {
    try {
      const past = await select<{ type: string; to_status: string | null }>("landing_lead_activities", `select=type,to_status&lead_id=eq.${lead.id}&limit=500`)
      firstQualification = !past.some((a) => a.type === "status_change" && a.to_status !== null && isQualifiedStage(a.to_status as Status))
    } catch {
      firstQualification = false
    }
  }
  // gouvernance des données : motif de perte (seulement pour « perdu », effacé si le lead quitte ce statut) et produit acheté (à la vente)
  const governance: Record<string, unknown> = {}
  if (status === "perdu" && opts.lostReason) governance.lost_reason = opts.lostReason
  else if (status !== "perdu" && lead.lost_reason) governance.lost_reason = null
  if (isBooking(status) && opts.purchasedProduct) governance.purchased_product = opts.purchasedProduct
  await updateWithGovernance(lead.id, patch, governance)
  if (lead.status !== status || opts.notes) {
    await logActivity(lead.id, actor, "status_change", {
      from_status: lead.status,
      to_status: status,
      body: [opts.bookingValue !== undefined ? `Montant : ${opts.bookingValue} TND` : null, opts.notes || null].filter(Boolean).join(" — ") || undefined,
    })
  }

  if (distinctOf.length) {
    await logActivity(lead.id, actor, "note", { body: `Réservation distincte confirmée (autre(s) dossier(s) : ${distinctOf.map((c) => c.ref ?? c.id.slice(0, 8)).join(", ")}) — motif : ${String(opts.distinctReservation).trim().slice(0, 300)}` }).catch(() => undefined)
  }
  if (holdReason) await logActivity(lead.id, actor, "note", { body: "Purchase retenu : le contrôle de doublon de réservation était indisponible. À examiner par un responsable." }).catch(() => undefined)

  let qualified: "envoyé" | "sans consentement" | undefined
  if (firstQualification) {
    if (!lead.tracking_consent) qualified = "sans consentement"
    else {
      // journalisé et relançable ; évènement personnalisé, jamais relayé depuis le navigateur (absent de ALLOWED_EVENTS)
      const r = await sendMetaLogged(buildConversionEvent(lead, "QualifiedLead", { eventId: `qualified-${lead.id}` }), { leadId: lead.id })
      if (r.ok) qualified = "envoyé"
    }
  }
  const withQualified = <T extends object>(r: T): T & { qualified?: "envoyé" | "sans consentement" } => (qualified ? { ...r, qualified } : r)

  // booked_at n'est posé qu'une fois : la vente n'est jamais renvoyée (pas de double comptage)
  if (!firstBooking || !adsEnabled) return withQualified({ ok: true as const, conversion: null })
  if (!lead.tracking_consent) return withQualified({ ok: true as const, conversion: "sans consentement" as const })

  const value = opts.bookingValue ?? lead.booking_value ?? 0
  if (holdReason) {
    // Purchase RETENU (journalisé, jamais envoyé) : libéré seulement après une décision humaine (rejet du signalement), jamais automatiquement.
    await holdPurchase(lead.id, Number(value) || 0, holdReason)
    return withQualified({ ok: true as const, conversion: "retenue" as const })
  }
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
  // Meta : charge utile construite par la source unique (journal + relance) ; TikTok : évènement ci-dessus (inchangé)
  const amount = Number(value)
  await Promise.allSettled([sendMetaLogged(buildConversionEvent(lead, "Purchase", { eventId: `purchase-${lead.id}`, value: Number.isFinite(amount) ? amount : 0 }), { leadId: lead.id, valueTnd: Number.isFinite(amount) ? amount : undefined }), sendTikTokEvent(event)])
  return withQualified({ ok: true as const, conversion: "envoyée" as const })
}

/** Écrit le patch ; si la base ne connaît pas encore les colonnes de gouvernance (migration 0026), les écrit sans elles plutôt que d'échouer. */
async function updateWithGovernance(id: string, patch: Record<string, unknown>, governance: Record<string, unknown>): Promise<void> {
  if (Object.keys(governance).length === 0) {
    await update("landing_leads", `id=eq.${id}`, patch)
    return
  }
  try {
    await update("landing_leads", `id=eq.${id}`, { ...patch, ...governance })
  } catch (e) {
    if (!(e instanceof DbError) || (e.code !== "42703" && e.code !== "PGRST204")) throw e
    await update("landing_leads", `id=eq.${id}`, patch)
  }
}

export type TestFlagResult = { ok: true } | { ok: false; error: string }

/** Marque (ou retire la marque) « lead de test » : exclu des analyses, jamais supprimé. Tracé dans l'historique. */
export async function setTestFlag(lead: LeadRow, isTest: boolean, actor: Actor): Promise<TestFlagResult> {
  if (lead.anonymized_at) return { ok: false, error: "Lead anonymisé : modification impossible" }
  try {
    await update("landing_leads", `id=eq.${lead.id}`, { is_test: isTest })
  } catch (e) {
    if (e instanceof DbError && (e.code === "42703" || e.code === "PGRST204")) return { ok: false, error: "La migration « gouvernance des données » (0026) n'est pas encore appliquée." }
    throw e
  }
  await logActivity(lead.id, actor, "note", { body: isTest ? "Marqué comme lead de TEST : exclu des analyses." : "Marque « test » retirée : le lead compte de nouveau dans les analyses." })
  return { ok: true }
}

export type EditResult = { ok: true } | { ok: false; error: string }
const LOCKED: EditResult = { ok: false, error: "Lead anonymisé : modification impossible" }

export async function addNote(lead: LeadRow, body: string, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  // note courte contrôlée (L2) : pas de message collé, ni numéro, ni e-mail, ni lien
  const n = checkNote(body, true)
  if (!n.ok) return { ok: false, error: n.error.replace("Pour le thème « Autre », une note", "Note vide : une note") }
  await logActivity(lead.id, actor, "note", { body: n.note })
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

/** Échange WhatsApp saisi par le conseiller (message reçu / envoyé) : aucune API ne le prouve, c'est une déclaration tracée.
 *  Thème obligatoire + note courte contrôlée (L2) : le texte du message n'est jamais conservé. */
export async function logWhatsApp(lead: LeadRow, direction: "in" | "out", input: { theme: string; note?: string }, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  const entry = buildConversationBody(input.theme, input.note ?? "")
  if (!entry.ok) return entry
  await logActivity(lead.id, actor, direction === "in" ? "wa_in" : "wa_out", { body: entry.body })
  return { ok: true }
}

/** Appel téléphonique saisi par le conseiller : même règle que WhatsApp, enregistré comme note « [Appel · Thème] … » (aucun nouveau type, aucune migration). */
export async function logCall(lead: LeadRow, input: { theme: string; note?: string }, actor: Actor): Promise<EditResult> {
  if (lead.anonymized_at) return LOCKED
  const entry = buildConversationBody(input.theme, input.note ?? "", "Appel")
  if (!entry.ok) return entry
  await logActivity(lead.id, actor, "note", { body: entry.body })
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
  /** Message WhatsApp reçu collé tel quel (ou seulement « E2B-XXXXXX ») : sert UNIQUEMENT à retrouver la référence puis le clic d'origine ; le texte n'est jamais conservé (L2). */
  waRef?: string
}

/** Saisie manuelle d'un lead arrivé par WhatsApp ou téléphone (sans formulaire). */
export type ManualLeadResult =
  | { ok: true; id: string; ref: string; existing?: boolean; attached?: "click" | "none" }
  | { ok: false; error: string }

export async function createManualLead(input: ManualLeadInput, actor: Actor): Promise<ManualLeadResult> {
  const name = input.name.trim()
  const phone = normalizePhone(input.phone)
  if (name.length < 2 || name.length > 200) return { ok: false, error: "Nom requis" }
  if (!phone) return { ok: false, error: "Téléphone invalide" }
  if (!isProduct(input.product)) return { ok: false, error: "Produit invalide" }
  if (!(SOURCES as readonly string[]).includes(input.source) || input.source === "form") return { ok: false, error: "Source invalide" }
  const [firstName, ...rest] = name.split(/\s+/)

  // Rattachement à la conversation d'origine (référence « Réf: E2B-… » du message reçu)
  let waRef: string | null = null
  if (input.waRef?.trim()) {
    waRef = parseWaRef(input.waRef)
    if (!waRef) return { ok: false, error: "Référence WhatsApp introuvable dans le texte (attendue : E2B-XXXXXX)" }
  }
  const conv = waRef ? await lookupConversation(waRef).catch(() => null) : null
  if (conv?.lead && !conv.lead.anonymized_at) {
    // le visiteur a déjà un lead : on ajoute le message à son historique au lieu de créer un doublon
    await logActivity(conv.lead.id, actor, "wa_in", { body: `Message reçu rattaché à ce lead (réf. ${waRef})` })
    return { ok: true, id: conv.lead.id, ref: conv.lead.ref, existing: true }
  }
  const click = conv?.clicks[0]
  const oldest = conv?.clicks.at(-1)

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
        // le prospect nous a lui-même contactés au sujet de sa demande
        contact_consent: true,
        marketing_consent: false,
        tracking_consent: false,
        assigned_to: actor.id, // le conseiller qui reçoit le message en est responsable
        ...(waRef ? { visitor_ref: waRef } : {}),
        // origine retrouvée par le clic du visiteur (campagne : donnée non personnelle ; aucun identifiant publicitaire copié)
        ...(click
          ? {
              channel: click.channel,
              utm_source: click.utm_source,
              utm_campaign: click.utm_campaign,
              utm_content: click.utm_content,
              ad_id: click.ad_id,
              first_channel: oldest?.channel ?? click.channel,
              first_utm_source: oldest?.utm_source ?? click.utm_source,
              first_utm_campaign: oldest?.utm_campaign ?? click.utm_campaign,
            }
          : {}),
      })
      await logActivity(row.id, actor, "created", { body: `Saisie manuelle (${SOURCE_LABELS[input.source as Source]})${conv ? ` — ${describeAttachment(conv)}` : ""}` })
      if (waRef || input.source === "whatsapp") await logActivity(row.id, actor, "wa_in", { body: "Premier message reçu" })
      return { ok: true, id: row.id, ref: row.ref, attached: waRef ? (click ? "click" : "none") : undefined }
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
