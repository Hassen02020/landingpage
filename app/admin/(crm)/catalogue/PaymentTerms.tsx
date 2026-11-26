import { select } from "@/lib/server/db"
import { offersWithoutTerms, type OfferTerms } from "@/lib/server/booking-confirmations"
import { savePaymentTermsAction } from "../../booking-actions"

/** Bloc « Conditions de paiement » (L7b) — administrateur : acompte, date limite, mention courte, « marquer comme définies ». */
export default async function PaymentTerms({ canManage }: { canManage: boolean }) {
  const missing = await offersWithoutTerms()
  if (!missing.migrationApplied) return <section id="conditions-paiement" className="bg-white rounded-2xl shadow-sm p-4 text-sm text-gray-600" role="status">Conditions de paiement : fonction pas encore activée sur cette base.</section>
  const offers = await select<OfferTerms>("landing_offers", "select=id,name,payment_terms_defined,deposit_kind,deposit_value,deposit_due_date,payment_terms_note,payment_terms_updated_at&archived_at=is.null&order=name&limit=200").catch(() => [])
  const bookingsOf = new Map(missing.rows.map((r) => [r.id, r.bookings]))
  return (
    <section id="conditions-paiement" className="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-3" aria-labelledby="cp-titre" data-testid="payment-terms">
      <h2 id="cp-titre" className="font-bold">Conditions de paiement</h2>
      <p className="text-gray-600">Une réservation ne peut être « Confirmée » que si les conditions de paiement de son offre sont définies. {canManage ? "" : "Lecture seule : seul un administrateur les modifie."}</p>
      {missing.rows.length > 0
        ? <p className="rounded-lg bg-amber-50 text-amber-900 p-2" data-testid="terms-missing">{missing.rows.length} offre(s) sans conditions définies : {missing.rows.slice(0, 8).map((r) => `${r.name} (${r.bookings} dossier(s) réservé(s))`).join(" ; ")}{missing.rows.length > 8 ? "…" : ""}</p>
        : <p className="text-green-800">Toutes les offres ont des conditions définies.</p>}
      <ul className="divide-y">
        {offers.map((o) => (
          <li key={o.id} className="py-2">
            <details>
              <summary className="cursor-pointer font-semibold">{o.name} · {o.payment_terms_defined ? "définies" : `non définies${bookingsOf.get(o.id) ? ` (${bookingsOf.get(o.id)} dossier(s) réservé(s))` : ""}`}</summary>
              <form action={savePaymentTermsAction} className="mt-2 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="offer_id" value={o.id} />
                <fieldset disabled={!canManage} className="contents">
                  <label className="block"><span className="text-gray-600">Acompte</span>
                    <select name="deposit_kind" defaultValue={o.deposit_kind ?? "aucun"} className="mt-1 w-full px-3 py-2 rounded-lg border"><option value="aucun">Aucun</option><option value="pourcentage">Pourcentage</option><option value="montant">Montant (TND)</option></select></label>
                  <label className="block"><span className="text-gray-600">Valeur</span>
                    <input name="deposit_value" inputMode="decimal" defaultValue={o.deposit_value ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border" /></label>
                  <label className="block"><span className="text-gray-600">Date limite (facultative)</span>
                    <input type="date" name="deposit_due_date" defaultValue={o.deposit_due_date ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border" /></label>
                  <label className="block"><span className="text-gray-600">Mention (140 max, ni numéro, ni e-mail, ni lien)</span>
                    <input name="payment_terms_note" maxLength={140} defaultValue={o.payment_terms_note ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border" /></label>
                  <div className="md:col-span-4 flex flex-wrap gap-2">
                    <button name="defined" value="1" className="px-3 py-2 rounded-lg bg-brand-700 text-white font-bold disabled:opacity-50">Marquer les conditions comme définies</button>
                    <button name="defined" value="0" className="px-3 py-2 rounded-lg border font-semibold disabled:opacity-50">Enregistrer sans les définir</button>
                  </div>
                </fieldset>
              </form>
            </details>
          </li>
        ))}
        {offers.length === 0 && <li className="py-2 text-gray-500">Aucune offre.</li>}
      </ul>
    </section>
  )
}
