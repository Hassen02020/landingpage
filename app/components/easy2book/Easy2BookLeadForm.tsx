import type { ComponentProps } from "react"
import { LeadCaptureForm } from "../LeadCaptureForm"

/**
 * Formulaire de réservation Easy2Book : enveloppe d'affichage autour de LeadCaptureForm.
 * La chaîne CRM (validation, consentements, anti-doublon, attribution, événements) n'est PAS dans ce composant et n'est pas modifiée : toutes les props sont transmises telles quelles.
 */
export function Easy2BookLeadForm({ title, subtitle, preview = false, bandClass, ...form }: { title: string; subtitle: string; preview?: boolean; bandClass: string } & ComponentProps<typeof LeadCaptureForm>) {
  return (
    <section id="reservation" className={`scroll-mt-4 py-10 ${bandClass}`}>
      <div className="max-w-xl mx-auto px-4">
        <h2 className="text-2xl font-black text-center mb-1">{title}</h2>
        <p className="text-center text-gray-600 mb-5">{subtitle}</p>
        <div className="bg-white rounded-3xl shadow-xl p-5">
          <fieldset disabled={preview} className="border-0 p-0 m-0 min-w-0">
            <LeadCaptureForm {...form} />
          </fieldset>
        </div>
      </div>
    </section>
  )
}
