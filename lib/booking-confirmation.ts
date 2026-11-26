// L7b — règle UNIQUE de « réservation confirmée » (décision Q2-A du propriétaire, 26/11/2026). Fonction pure, sans accès base.
// Confirmée = confirmation du fournisseur enregistrée (oui) ET conditions de paiement de l'offre du dossier DÉFINIES ET dossier marqué
// « conditions de paiement respectées ». Une commission confirmée, un paiement ou une confirmation fournisseur seuls ne suffisent jamais.
// Réservation enregistrée, réservation confirmée et commission confirmée restent trois notions séparées.

export type YesNo = "oui" | "non"
export type BookingConfirmationState = "non_renseigne" | "fournisseur_confirme_paiement_a_suivre" | "conditions_non_definies" | "fournisseur_non_confirme" | "confirmee"

export const BOOKING_STATE_LABELS: Record<BookingConfirmationState, string> = {
  non_renseigne: "Non renseigné",
  fournisseur_confirme_paiement_a_suivre: "Fournisseur confirmé, paiement à suivre",
  conditions_non_definies: "Conditions de paiement non définies",
  fournisseur_non_confirme: "Fournisseur non confirmé",
  confirmee: "Confirmée",
}

export type BookingConfirmationInput = {
  /** saisie du dossier ; null/undefined = aucune saisie */
  confirmation: { supplier_confirmed?: YesNo | null; payment_respected?: YesNo | null } | null | undefined
  /** vrai seulement si le dossier a une offre du catalogue dont les conditions de paiement sont définies */
  paymentTermsDefined: boolean
}

export function bookingConfirmationState(i: BookingConfirmationInput): BookingConfirmationState {
  const c = i.confirmation
  const supplier = c?.supplier_confirmed ?? null
  const payment = c?.payment_respected ?? null
  if (supplier === null && payment === null) return "non_renseigne"
  if (supplier === "non") return "fournisseur_non_confirme"
  if (supplier !== "oui") return "non_renseigne" // paiement saisi seul : jamais confirmée
  if (!i.paymentTermsDefined) return "conditions_non_definies"
  return payment === "oui" ? "confirmee" : "fournisseur_confirme_paiement_a_suivre"
}

export const isBookingConfirmed = (i: BookingConfirmationInput): boolean => bookingConfirmationState(i) === "confirmee"

// ---------- Validation (mêmes refus que les notes du lot L2 : ni téléphone, ni e-mail, ni lien ; 140 caractères) ----------
export const SHORT_NOTE_MAX = 140

export function shortNoteError(raw: unknown): string | null {
  if (raw == null || raw === "") return null
  if (typeof raw !== "string") return "Mention invalide."
  const t = raw.trim()
  if (t.length > SHORT_NOTE_MAX) return `Mention trop longue (${SHORT_NOTE_MAX} caractères au plus).`
  if (/@/.test(t)) return "Pas d'adresse e-mail dans la mention."
  if (/(https?:|www\.|\.(com|net|org|tn|fr)\b)/i.test(t)) return "Pas de lien dans la mention."
  if (/(\+|00)?[0-9][0-9 .()-]{6,}[0-9]/.test(t)) return "Pas de numéro de téléphone dans la mention."
  return null
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/
export function dateError(raw: unknown, today = new Date()): string | null {
  if (typeof raw !== "string" || !isoDate.test(raw) || Number.isNaN(Date.parse(raw))) return "Date invalide."
  if (raw < "2020-01-01") return "Date invalide."
  const limit = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10)
  if (raw > limit) return "La date ne peut pas être dans le futur."
  return null
}

export type ConfirmationForm = { supplier_confirmed: YesNo | null; supplier_confirmed_on: string | null; supplier_proof_note: string | null; payment_respected: YesNo | null; payment_respected_on: string | null }

export function validateConfirmationForm(f: Partial<ConfirmationForm>, today = new Date()): { ok: true; value: ConfirmationForm } | { ok: false; error: string } {
  const yn = (v: unknown) => (v === "oui" || v === "non" ? v : null)
  const supplier = yn(f.supplier_confirmed)
  const payment = yn(f.payment_respected)
  if (supplier === null && payment === null) return { ok: false, error: "Renseignez au moins la confirmation du fournisseur ou le paiement." }
  const out: ConfirmationForm = { supplier_confirmed: supplier, supplier_confirmed_on: null, supplier_proof_note: null, payment_respected: payment, payment_respected_on: null }
  if (supplier === "oui") {
    if (!f.supplier_confirmed_on) return { ok: false, error: "Indiquez la date de confirmation du fournisseur." }
    const e = dateError(f.supplier_confirmed_on, today); if (e) return { ok: false, error: e }
    out.supplier_confirmed_on = f.supplier_confirmed_on
  }
  const noteErr = shortNoteError(f.supplier_proof_note); if (noteErr) return { ok: false, error: noteErr }
  out.supplier_proof_note = f.supplier_proof_note?.trim() || null
  if (payment === "oui") {
    if (!f.payment_respected_on) return { ok: false, error: "Indiquez la date du paiement." }
    const e = dateError(f.payment_respected_on, today); if (e) return { ok: false, error: e }
    out.payment_respected_on = f.payment_respected_on
  }
  return { ok: true, value: out }
}

// ---------- Conditions de paiement d'une offre ----------
export type DepositKind = "aucun" | "pourcentage" | "montant"
export type PaymentTermsForm = { deposit_kind: DepositKind; deposit_value: number | null; deposit_due_date: string | null; payment_terms_note: string | null }

export function validatePaymentTerms(f: { deposit_kind?: unknown; deposit_value?: unknown; deposit_due_date?: unknown; payment_terms_note?: unknown }): { ok: true; value: PaymentTermsForm } | { ok: false; error: string } {
  const kind = f.deposit_kind
  if (kind !== "aucun" && kind !== "pourcentage" && kind !== "montant") return { ok: false, error: "Choisissez le type d'acompte." }
  let value: number | null = null
  if (kind !== "aucun") {
    value = typeof f.deposit_value === "number" ? f.deposit_value : Number(f.deposit_value)
    if (f.deposit_value === "" || f.deposit_value == null || !Number.isFinite(value) || value < 0) return { ok: false, error: "Indiquez une valeur d'acompte valide." }
    if (kind === "pourcentage" && value > 100) return { ok: false, error: "Un pourcentage ne dépasse pas 100." }
    if (value > 100_000_000) return { ok: false, error: "Valeur trop élevée." }
  }
  let due: string | null = null
  if (f.deposit_due_date) {
    if (typeof f.deposit_due_date !== "string" || !isoDate.test(f.deposit_due_date) || Number.isNaN(Date.parse(f.deposit_due_date))) return { ok: false, error: "Date limite invalide." }
    due = f.deposit_due_date
  }
  const noteErr = shortNoteError(f.payment_terms_note); if (noteErr) return { ok: false, error: noteErr }
  return { ok: true, value: { deposit_kind: kind, deposit_value: value, deposit_due_date: due, payment_terms_note: typeof f.payment_terms_note === "string" ? f.payment_terms_note.trim() || null : null } }
}
