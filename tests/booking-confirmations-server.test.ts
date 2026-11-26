import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  conf: [] as any[], activities: [] as any[], offers: [{ id: "11111111-1111-4111-8111-111111111111", name: "Omra Ramadan", payment_terms_defined: false } as any], missing: false,
}))
vi.mock("@/lib/server/db", () => {
  class DbError extends Error { constructor(public status: number, public code?: string, m = "x") { super(m) } get isUniqueViolation() { return false } }
  return {
    DbError,
    select: vi.fn(async (table: string, q: string) => {
      if (state.missing) throw new DbError(404, "PGRST205", "table")
      if (table === "landing_booking_confirmations") return state.conf.filter((c) => q.includes(`lead_id=eq.${c.lead_id}`))
      if (table === "landing_offers") return state.offers.filter((o) => q.includes(`id=eq.${o.id}`) || !q.includes("id=eq."))
      return []
    }),
    insertOne: vi.fn(async (table: string, row: any) => { const r = { id: state.conf.length + 1, ...row }; state.conf.push(r); return r }),
    update: vi.fn(async (table: string, filter: string, patch: any) => {
      if (table === "landing_booking_confirmations") { const r = state.conf.find((c) => filter.includes(c.lead_id)); Object.assign(r, patch); return [r] }
      const o = state.offers.find((x) => filter.includes(x.id)); if (!o) return []; Object.assign(o, patch); return [o]
    }),
    insertQuiet: vi.fn(async (_t: string, row: any) => { state.activities.push(row) }),
  }
})
vi.mock("@/lib/server/lead-scope", () => ({ selectLeadsExcludingDuplicates: vi.fn(async () => []) }))

import { getBookingView, saveBookingConfirmation, saveOfferPaymentTerms } from "@/lib/server/booking-confirmations"
import { canConfirmBooking, can } from "@/lib/permissions"

const OFFER = "11111111-1111-4111-8111-111111111111"
const lead = (o: any = {}) => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "reserve", anonymized_at: null, offer_id: OFFER, assigned_to: "emp1", ...o }) as any
const actor = { id: "emp1", label: "e@x.tn", ownOnly: true }
const today = new Date().toISOString().slice(0, 10)

beforeEach(() => { state.conf.length = 0; state.activities.length = 0; state.missing = false; state.offers[0] = { id: OFFER, name: "Omra Ramadan", payment_terms_defined: false } })

describe("droits (L7b)", () => {
  it("employé : ses dossiers seulement ; manager et administrateur : tous ; conditions de paiement : administrateur seul", () => {
    expect(canConfirmBooking("employee", "emp1", { assigned_to: "emp1" })).toBe(true)
    expect(canConfirmBooking("employee", "emp1", { assigned_to: "emp2" })).toBe(false)
    expect(canConfirmBooking("employee", "emp1", { assigned_to: null })).toBe(false)
    expect(canConfirmBooking("manager", "m", { assigned_to: "emp2" })).toBe(true)
    expect(canConfirmBooking("admin", "a", { assigned_to: null })).toBe(true)
    expect(canConfirmBooking(null, "x", { assigned_to: "x" })).toBe(false)
    expect(can("admin", "payment_terms.manage")).toBe(true)
    expect(can("manager", "payment_terms.manage")).toBe(false)
    expect(can("employee", "payment_terms.manage")).toBe(false)
  })
})

describe("saisie de la confirmation", () => {
  it("jamais « Confirmée » tant que les conditions de l'offre ne sont pas définies, puis Confirmée quand les trois conditions sont vraies", async () => {
    const f = { supplier_confirmed: "oui" as const, supplier_confirmed_on: today, supplier_proof_note: "e-mail du fournisseur du 24/11", payment_respected: "oui" as const, payment_respected_on: today }
    expect(await saveBookingConfirmation(lead(), f, actor)).toEqual({ ok: true })
    expect((await getBookingView(lead())).state).toBe("conditions_non_definies")
    expect(await saveOfferPaymentTerms(OFFER, { deposit_kind: "pourcentage", deposit_value: "30" }, true, "adm")).toEqual({ ok: true })
    expect((await getBookingView(lead())).state).toBe("confirmee")
    await saveBookingConfirmation(lead(), { ...f, payment_respected: "non", payment_respected_on: null }, actor)
    expect((await getBookingView(lead())).state).toBe("fournisseur_confirme_paiement_a_suivre")
    expect(state.conf).toHaveLength(1) // une seule ligne par dossier
  })
  it("dossier sans offre du catalogue : conditions non définies", async () => {
    await saveBookingConfirmation(lead({ offer_id: null }), { supplier_confirmed: "oui", supplier_confirmed_on: today, payment_respected: "oui", payment_respected_on: today }, actor)
    expect((await getBookingView(lead({ offer_id: null }))).state).toBe("conditions_non_definies")
  })
  it("l'historique reçoit un libellé court, jamais la mention saisie", async () => {
    await saveBookingConfirmation(lead(), { supplier_confirmed: "oui", supplier_confirmed_on: today, supplier_proof_note: "mention secrète" }, actor)
    expect(state.activities).toHaveLength(1)
    expect(state.activities[0]).toMatchObject({ type: "booking_confirmation_changed", body: "Fournisseur : oui · Paiement : —" })
    expect(JSON.stringify(state.activities)).not.toContain("secrète")
  })
  it("refus : dossier non réservé, anonymisé, date future, mention avec e-mail ; rien n'est enregistré", async () => {
    const ok = { supplier_confirmed: "oui" as const, supplier_confirmed_on: today }
    expect((await saveBookingConfirmation(lead({ status: "nouveau" }), ok, actor)).ok).toBe(false)
    expect((await saveBookingConfirmation(lead({ anonymized_at: "2026-01-01" }), ok, actor)).ok).toBe(false)
    expect((await saveBookingConfirmation(lead(), { ...ok, supplier_confirmed_on: "2099-01-01" }, actor)).ok).toBe(false)
    expect((await saveBookingConfirmation(lead(), { ...ok, supplier_proof_note: "a@b.tn" }, actor)).ok).toBe(false)
    expect(state.conf).toEqual([]); expect(state.activities).toEqual([])
  })
  it("sans la migration : état « Non renseigné », message clair, aucune erreur", async () => {
    state.missing = true
    expect(await getBookingView(lead())).toMatchObject({ migrationApplied: false, state: "non_renseigne" })
    expect((await saveBookingConfirmation(lead(), { supplier_confirmed: "non" }, actor)).ok).toBe(false)
  })
  it("conditions de paiement : validation (pourcentage > 100, mention avec lien)", async () => {
    expect((await saveOfferPaymentTerms(OFFER, { deposit_kind: "pourcentage", deposit_value: "120" }, true, "adm")).ok).toBe(false)
    expect((await saveOfferPaymentTerms(OFFER, { deposit_kind: "aucun", payment_terms_note: "https://x.tn" }, true, "adm")).ok).toBe(false)
    expect((await saveOfferPaymentTerms("pas-un-uuid", { deposit_kind: "aucun" }, true, "adm")).ok).toBe(false)
    expect(state.offers[0].payment_terms_defined).toBe(false)
  })
})
