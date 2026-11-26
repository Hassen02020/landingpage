"use server"

// L7b — actions de saisie de la confirmation des réservations et des conditions de paiement des offres.
// Identité, rôle et appartenance au dossier revérifiés à chaque appel (jamais de confiance dans le formulaire).
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { currentStaff } from "@/lib/server/auth"
import { can, canConfirmBooking } from "@/lib/permissions"
import { rateLimited } from "@/lib/server/guard"
import { getLead } from "@/lib/server/crm"
import { saveBookingConfirmation, saveOfferPaymentTerms } from "@/lib/server/booking-confirmations"

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()
const back = (id: string, kind: "ok" | "erreur", msg: string) => `/admin/leads/${id}?${kind}=${encodeURIComponent(msg)}#confirmation`

export async function saveBookingConfirmationAction(fd: FormData): Promise<void> {
  const staff = await currentStaff()
  if (!staff) redirect("/admin/login")
  // getLead applique la restriction « employé = ses dossiers » : le dossier d'un collègue est introuvable (réponse neutre)
  const lead = await getLead(field(fd, "id"))
  if (!lead) redirect("/admin?erreur=introuvable")
  if (!canConfirmBooking(staff.orgRole, staff.userId, lead)) redirect(back(lead.id, "erreur", "Vous ne pouvez pas modifier la confirmation de ce dossier."))
  if (rateLimited(`booking-confirm:${staff.userId}`, 60, 10 * 60 * 1000)) redirect(back(lead.id, "erreur", "Trop de saisies. Réessayez dans quelques minutes."))
  const res = await saveBookingConfirmation(lead, {
    supplier_confirmed: field(fd, "supplier_confirmed") as "oui" | "non",
    supplier_confirmed_on: field(fd, "supplier_confirmed_on") || null,
    supplier_proof_note: field(fd, "supplier_proof_note") || null,
    payment_respected: field(fd, "payment_respected") as "oui" | "non",
    payment_respected_on: field(fd, "payment_respected_on") || null,
  }, { id: staff.userId, label: staff.email, ownOnly: !can(staff.orgRole, "leads.view_all") })
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!res.ok) redirect(back(lead.id, "erreur", res.error))
  redirect(back(lead.id, "ok", "Confirmation enregistrée."))
}

export async function savePaymentTermsAction(fd: FormData): Promise<void> {
  const staff = await currentStaff()
  const offerId = field(fd, "offer_id")
  const to = (kind: "ok" | "erreur", msg: string) => `/admin/catalogue?${kind}=${encodeURIComponent(msg)}#conditions-paiement`
  if (!staff || !can(staff.orgRole, "payment_terms.manage")) redirect(to("erreur", "Réservé aux administrateurs."))
  if (rateLimited(`payment-terms:${staff.userId}`, 60, 10 * 60 * 1000)) redirect(to("erreur", "Trop de saisies. Réessayez dans quelques minutes."))
  const res = await saveOfferPaymentTerms(offerId, {
    deposit_kind: field(fd, "deposit_kind"), deposit_value: field(fd, "deposit_value"),
    deposit_due_date: field(fd, "deposit_due_date"), payment_terms_note: field(fd, "payment_terms_note"),
  }, field(fd, "defined") === "1", staff.userId)
  revalidatePath("/admin/catalogue")
  if (!res.ok) redirect(to("erreur", res.error))
  redirect(to("ok", field(fd, "defined") === "1" ? "Conditions marquées comme définies." : "Conditions enregistrées (non définies)."))
}
