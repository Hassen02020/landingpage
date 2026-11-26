import { BOOKING_STATE_LABELS } from "@/lib/booking-confirmation"
import type { BookingView } from "@/lib/server/booking-confirmations"
import { saveBookingConfirmationAction } from "../../../booking-actions"
import { formatDate } from "../../../format"
import NoteField from "./NoteField"

const BADGE: Record<string, string> = {
  confirmee: "bg-green-100 text-green-800",
  fournisseur_confirme_paiement_a_suivre: "bg-amber-100 text-amber-900",
  conditions_non_definies: "bg-amber-100 text-amber-900",
  fournisseur_non_confirme: "bg-red-100 text-red-800",
  non_renseigne: "bg-gray-200 text-gray-700",
}
const depositText = (o: NonNullable<BookingView["offer"]>) =>
  o.deposit_kind === "aucun" ? "aucun acompte" : o.deposit_kind === "pourcentage" ? `acompte ${o.deposit_value} %` : o.deposit_kind === "montant" ? `acompte ${o.deposit_value} TND` : "acompte non précisé"

/** Bloc « Confirmation de la réservation » (L7b) — état calculé par la règle unique de lib/booking-confirmation.ts. */
export default function BookingConfirmation({ leadId, view, canEdit, isBooking, locked }: { leadId: string; view: BookingView; canEdit: boolean; isBooking: boolean; locked: boolean }) {
  const c = view.confirmation
  const disabled = !canEdit || !isBooking || locked
  const why = locked ? "Dossier anonymisé : lecture seule." : !isBooking ? "La confirmation se saisit quand le dossier est réservé ou gagné." : !canEdit ? "Vous ne pouvez pas modifier ce dossier." : null
  return (
    <section id="confirmation" className="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-3" aria-labelledby="confirmation-titre" data-testid="booking-confirmation">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="confirmation-titre" className="font-bold">Confirmation de la réservation</h2>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${BADGE[view.state]}`} data-testid="booking-state">{BOOKING_STATE_LABELS[view.state]}</span>
      </div>
      {!view.migrationApplied && <p className="text-gray-600" role="status">Cette fonction n&apos;est pas encore activée sur cette base : l&apos;état reste « Non renseigné ».</p>}
      <p className="text-gray-600">
        Confirmée = confirmation du fournisseur enregistrée, conditions de paiement de l&apos;offre définies et paiement respecté. Aucun document n&apos;est conservé ici : seulement une mention courte de la preuve.
      </p>
      <p className="text-gray-700" data-testid="booking-terms">
        {view.offer
          ? <>Offre : <strong>{view.offer.name}</strong> · {view.offer.payment_terms_defined ? <>conditions définies ({depositText(view.offer)}{view.offer.deposit_due_date ? `, avant le ${formatDate(view.offer.deposit_due_date)}` : ""}){view.offer.payment_terms_note ? ` : ${view.offer.payment_terms_note}` : ""}</> : "conditions de paiement non définies"}</>
          : "Aucune offre du catalogue rattachée à ce dossier : conditions de paiement non définies, la réservation ne peut pas être « Confirmée »."}
      </p>
      {why && <p className="text-gray-500" role="note">{why}</p>}
      {view.migrationApplied && (
        <form action={saveBookingConfirmationAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={leadId} />
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="font-semibold">Confirmation du fournisseur</legend>
            <label className="block"><span className="text-gray-600">Confirmé par le fournisseur ?</span>
              <select name="supplier_confirmed" defaultValue={c?.supplier_confirmed ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border"><option value="">Non renseigné</option><option value="oui">Oui</option><option value="non">Non</option></select>
            </label>
            <label className="block"><span className="text-gray-600">Date de confirmation (exigée si « oui »)</span>
              <input type="date" name="supplier_confirmed_on" defaultValue={c?.supplier_confirmed_on ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
            <NoteField name="supplier_proof_note" label="Preuve (mention courte, ex. « e-mail du fournisseur du 24/11 »)" defaultValue={c?.supplier_proof_note} disabled={disabled} />
          </fieldset>
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="font-semibold">Paiement</legend>
            <label className="block"><span className="text-gray-600">Conditions de paiement respectées ?</span>
              <select name="payment_respected" defaultValue={c?.payment_respected ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border"><option value="">Non renseigné</option><option value="oui">Oui</option><option value="non">Non</option></select>
            </label>
            <label className="block"><span className="text-gray-600">Date du paiement (exigée si « oui »)</span>
              <input type="date" name="payment_respected_on" defaultValue={c?.payment_respected_on ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
            <button disabled={disabled} className="w-full bg-brand-700 text-white font-bold py-2 rounded-lg disabled:opacity-50">Enregistrer la confirmation</button>
          </fieldset>
        </form>
      )}
      {c && <p className="text-xs text-gray-500">Dernière saisie le {formatDate(c.updated_at)}. Chaque modification apparaît dans l&apos;historique du dossier.</p>}
    </section>
  )
}
