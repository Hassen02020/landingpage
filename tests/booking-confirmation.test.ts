import { describe, expect, it } from "vitest"
import { bookingConfirmationState as st, isBookingConfirmed, shortNoteError, validateConfirmationForm, validatePaymentTerms } from "../lib/booking-confirmation"

const TODAY = new Date("2026-11-26T12:00:00Z")
describe("règle de confirmation (Q2-A)", () => {
  it("aucune saisie → Non renseigné, jamais confirmée", () => {
    expect(st({ confirmation: null, paymentTermsDefined: true })).toBe("non_renseigne")
    expect(st({ confirmation: undefined, paymentTermsDefined: false })).toBe("non_renseigne")
  })
  it("paiement seul → jamais confirmée", () => {
    expect(st({ confirmation: { payment_respected: "oui" }, paymentTermsDefined: true })).toBe("non_renseigne")
  })
  it("confirmation fournisseur sans conditions définies (ou offre absente du catalogue) → Conditions non définies", () => {
    expect(st({ confirmation: { supplier_confirmed: "oui", payment_respected: "oui" }, paymentTermsDefined: false })).toBe("conditions_non_definies")
  })
  it("fournisseur « non » → Fournisseur non confirmé, même si payé et conditions définies", () => {
    expect(st({ confirmation: { supplier_confirmed: "non", payment_respected: "oui" }, paymentTermsDefined: true })).toBe("fournisseur_non_confirme")
  })
  it("fournisseur oui + conditions définies, paiement non respecté ou non saisi → paiement à suivre", () => {
    expect(st({ confirmation: { supplier_confirmed: "oui", payment_respected: "non" }, paymentTermsDefined: true })).toBe("fournisseur_confirme_paiement_a_suivre")
    expect(st({ confirmation: { supplier_confirmed: "oui" }, paymentTermsDefined: true })).toBe("fournisseur_confirme_paiement_a_suivre")
  })
  it("les trois conditions vraies → Confirmée, et seulement alors", () => {
    expect(isBookingConfirmed({ confirmation: { supplier_confirmed: "oui", payment_respected: "oui" }, paymentTermsDefined: true })).toBe(true)
    for (const sc of ["oui", "non", null] as const) for (const pr of ["oui", "non", null] as const) for (const d of [true, false]) {
      const expected = sc === "oui" && pr === "oui" && d
      expect(isBookingConfirmed({ confirmation: { supplier_confirmed: sc, payment_respected: pr }, paymentTermsDefined: d })).toBe(expected)
    }
  })
})

describe("validation", () => {
  it("mention : 140 car., ni téléphone, ni e-mail, ni lien", () => {
    expect(shortNoteError("e-mail du fournisseur du 24/11")).toBeNull()
    for (const bad of ["x".repeat(141), "a@b.tn", "https://x.tn", "www.x.tn", "21612345678", "+216 12 345 678"]) expect(shortNoteError(bad)).not.toBeNull()
  })
  it("date exigée si « oui », jamais dans le futur", () => {
    expect(validateConfirmationForm({ supplier_confirmed: "oui" }, TODAY).ok).toBe(false)
    expect(validateConfirmationForm({ supplier_confirmed: "oui", supplier_confirmed_on: "2026-12-30" }, TODAY).ok).toBe(false)
    expect(validateConfirmationForm({ supplier_confirmed: "oui", supplier_confirmed_on: "2026-11-24", supplier_proof_note: " ok " }, TODAY)).toMatchObject({ ok: true, value: { supplier_proof_note: "ok" } })
    expect(validateConfirmationForm({ payment_respected: "oui" }, TODAY).ok).toBe(false)
    expect(validateConfirmationForm({}, TODAY).ok).toBe(false)
    expect(validateConfirmationForm({ supplier_confirmed: "non" }, TODAY).ok).toBe(true)
  })
  it("conditions de paiement : type obligatoire, pourcentage ≤ 100, valeur absente si « aucun »", () => {
    expect(validatePaymentTerms({}).ok).toBe(false)
    expect(validatePaymentTerms({ deposit_kind: "pourcentage", deposit_value: 120 }).ok).toBe(false)
    expect(validatePaymentTerms({ deposit_kind: "montant", deposit_value: "" }).ok).toBe(false)
    expect(validatePaymentTerms({ deposit_kind: "pourcentage", deposit_value: "30", payment_terms_note: "a@b.tn" }).ok).toBe(false)
    expect(validatePaymentTerms({ deposit_kind: "aucun", deposit_value: 50 })).toMatchObject({ ok: true, value: { deposit_value: null } })
    expect(validatePaymentTerms({ deposit_kind: "pourcentage", deposit_value: "30", deposit_due_date: "2027-01-10" })).toMatchObject({ ok: true, value: { deposit_value: 30 } })
  })
})
