// L7b — confirmation des réservations (décision Q2-A) : saisie manuelle structurée, jamais d'import automatique.
// Le serveur charge TOUJOURS le dossier d'abord (restriction « l'employé ne voit que ses dossiers » appliquée dans db.ts) ; ces fonctions
// ne reçoivent qu'un dossier déjà autorisé. Tolère l'absence de la migration 0032 : rien ne casse, l'état reste « Non renseigné ».
import { DbError, insertOne, select, update } from "@/lib/server/db"
import { isMissingTable } from "@/lib/server/ad-spend"
import { logActivity, type Actor, type LeadRow } from "@/lib/server/crm"
import { bookingConfirmationState, validateConfirmationForm, validatePaymentTerms, type BookingConfirmationState, type ConfirmationForm, type DepositKind } from "@/lib/booking-confirmation"
import { selectLeadsExcludingDuplicates } from "@/lib/server/lead-scope"
import { isBooking } from "@/lib/status"

export interface ConfirmationRow extends ConfirmationForm { id: number; lead_id: string; entered_by: string | null; updated_by: string | null; created_at: string; updated_at: string }
export interface OfferTerms {
  id: string; name: string
  payment_terms_defined: boolean; deposit_kind: DepositKind | null; deposit_value: number | null; deposit_due_date: string | null
  payment_terms_note: string | null; payment_terms_updated_at: string | null
}
export interface BookingView {
  migrationApplied: boolean
  confirmation: ConfirmationRow | null
  offer: OfferTerms | null
  state: BookingConfirmationState
}

const isMissingColumn = (e: unknown) => e instanceof DbError && (e.code === "42703" || e.code === "PGRST204" || (e.status === 400 && /column/i.test(e.message)))
const unavailable = (e: unknown) => isMissingTable(e) || isMissingColumn(e)
const OFFER_COLS = "id,name,payment_terms_defined,deposit_kind,deposit_value,deposit_due_date,payment_terms_note,payment_terms_updated_at"

export async function getBookingView(lead: Pick<LeadRow, "id" | "offer_id">): Promise<BookingView> {
  let confirmation: ConfirmationRow | null = null
  let offer: OfferTerms | null = null
  let migrationApplied = true
  try {
    ;[confirmation = null] = await select<ConfirmationRow>("landing_booking_confirmations", `select=*&lead_id=eq.${lead.id}&limit=1`)
    if (lead.offer_id && /^[0-9a-f-]{36}$/i.test(lead.offer_id)) [offer = null] = await select<OfferTerms>("landing_offers", `select=${OFFER_COLS}&id=eq.${lead.offer_id}&limit=1`)
  } catch (e) {
    if (!unavailable(e)) throw e
    migrationApplied = false
  }
  return { migrationApplied, confirmation, offer, state: bookingConfirmationState({ confirmation, paymentTermsDefined: Boolean(offer?.payment_terms_defined) }) }
}

/** État de confirmation d'un ensemble de dossiers (pour les indicateurs de l'étape 5) : une seule lecture. */
export async function confirmationStates(leads: { id: string; offer_id?: string | null }[]): Promise<{ migrationApplied: boolean; states: Map<string, BookingConfirmationState> }> {
  const states = new Map<string, BookingConfirmationState>()
  try {
    const conf = await select<ConfirmationRow>("landing_booking_confirmations", "select=lead_id,supplier_confirmed,payment_respected&limit=5000")
    const offers = await select<{ id: string; payment_terms_defined: boolean }>("landing_offers", "select=id,payment_terms_defined&payment_terms_defined=eq.true&limit=2000")
    const defined = new Set(offers.map((o) => o.id))
    const byLead = new Map(conf.map((c) => [c.lead_id, c]))
    for (const l of leads) states.set(l.id, bookingConfirmationState({ confirmation: byLead.get(l.id) ?? null, paymentTermsDefined: Boolean(l.offer_id && defined.has(l.offer_id)) }))
    return { migrationApplied: true, states }
  } catch (e) {
    if (!unavailable(e)) throw e
    for (const l of leads) states.set(l.id, "non_renseigne")
    return { migrationApplied: false, states }
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string }

const label = (v: string | null) => (v === "oui" ? "oui" : v === "non" ? "non" : "—")

/** Enregistre (ou corrige) la confirmation d'un dossier réservé. L'historique reçoit un libellé COURT, jamais la mention saisie. */
export async function saveBookingConfirmation(lead: LeadRow, input: Partial<ConfirmationForm>, actor: Actor): Promise<SaveResult> {
  if (lead.anonymized_at) return { ok: false, error: "Dossier anonymisé : lecture seule." }
  if (!isBooking(lead.status)) return { ok: false, error: "La confirmation se saisit sur un dossier réservé ou gagné." }
  const v = validateConfirmationForm(input)
  if (!v.ok) return v
  const f = v.value
  try {
    const [existing] = await select<{ id: number }>("landing_booking_confirmations", `select=id&lead_id=eq.${lead.id}&limit=1`)
    const row = { ...f, updated_by: actor.id }
    if (existing) await update("landing_booking_confirmations", `lead_id=eq.${lead.id}`, row)
    else await insertOne("landing_booking_confirmations", { ...row, lead_id: lead.id, entered_by: actor.id })
  } catch (e) {
    if (unavailable(e)) return { ok: false, error: "Cette fonction n'est pas encore activée sur cette base." }
    console.error("[booking-confirmation] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, error: "Enregistrement impossible. Réessayez." }
  }
  await logActivity(lead.id, actor, "booking_confirmation_changed", { body: `Fournisseur : ${label(f.supplier_confirmed)} · Paiement : ${label(f.payment_respected)}` })
  return { ok: true }
}

/** Conditions de paiement d'une offre (administrateur). `defined` vrai = « Marquer les conditions comme définies ». */
export async function saveOfferPaymentTerms(offerId: string, input: Parameters<typeof validatePaymentTerms>[0], defined: boolean, actorId: string | null): Promise<SaveResult> {
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return { ok: false, error: "Offre introuvable." }
  const v = validatePaymentTerms(input)
  if (!v.ok) return v
  try {
    const done = await update<{ id: string }>("landing_offers", `id=eq.${offerId}`, {
      ...v.value, payment_terms_defined: defined, payment_terms_updated_by: actorId, payment_terms_updated_at: new Date().toISOString(),
    })
    if (!done.length) return { ok: false, error: "Offre introuvable." }
  } catch (e) {
    if (unavailable(e)) return { ok: false, error: "Cette fonction n'est pas encore activée sur cette base." }
    console.error("[payment-terms] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, error: "Enregistrement impossible. Réessayez." }
  }
  return { ok: true }
}

/** Offres sans conditions définies, avec le nombre de dossiers réservés ou gagnés concernés (écran Catalogue). */
export async function offersWithoutTerms(): Promise<{ migrationApplied: boolean; rows: { id: string; name: string; bookings: number }[] }> {
  try {
    const offers = await select<{ id: string; name: string }>("landing_offers", "select=id,name&payment_terms_defined=eq.false&archived_at=is.null&limit=500")
    if (!offers.length) return { migrationApplied: true, rows: [] }
    const leads = await selectLeadsExcludingDuplicates<{ offer_id: string }>("select=offer_id&status=in.(reserve,gagne)&offer_id=not.is.null&limit=5000").catch(() => [])
    const count = new Map<string, number>()
    for (const l of leads) count.set(l.offer_id, (count.get(l.offer_id) ?? 0) + 1)
    return { migrationApplied: true, rows: offers.map((o) => ({ ...o, bookings: count.get(o.id) ?? 0 })).sort((a, b) => b.bookings - a.bookings) }
  } catch (e) {
    if (!unavailable(e)) throw e
    return { migrationApplied: false, rows: [] }
  }
}
