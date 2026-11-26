"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveWhatsAppNumberAction } from "../../whatsapp-numbers-actions"
import type { WhatsAppNumberView } from "@/lib/server/whatsapp-numbers"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
      {pending ? "…" : "Enregistrer"}
    </button>
  )
}

export function WhatsAppCard({ numbers, webhookUrl, webhookReady, migrationApplied }: { numbers: WhatsAppNumberView[]; webhookUrl: string; webhookReady: boolean; migrationApplied: boolean }) {
  const [state, save] = useFormState(saveWhatsAppNumberAction, undefined)
  const input = "w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
  const err = (k: string) => state?.errors?.[k]
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-2">
      <div className="bg-gradient-to-br from-green-100 to-green-50 px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-gray-900">WhatsApp Business — messages entrants</h2>
          <p className="text-xs text-gray-600">Un message reçu avec une référence E2B est rattaché à son lead ; sinon un lead est créé. Le texte du message n&apos;est pas conservé. Aucun message n&apos;est envoyé.</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${webhookReady ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{webhookReady ? "Réception prête" : "Réception inactive"}</span>
      </div>
      <div className="p-5 space-y-4">
        {!migrationApplied && <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">La migration 0024 n&apos;est pas encore appliquée dans Supabase : cette carte est en lecture seule.</p>}
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            Adresse du webhook à saisir dans l&apos;application Meta (produit WhatsApp, champ <code>messages</code>) : <code className="bg-gray-50 border rounded px-1.5 py-0.5 text-xs break-all select-all" dir="ltr">{webhookUrl}</code>
          </p>
          {!webhookReady && (
            <p className="text-amber-800">
              La réception reste inactive tant que <code>WHATSAPP_VERIFY_TOKEN</code> et le secret de l&apos;application (<code>WHATSAPP_APP_SECRET</code>, ou <code>META_APP_SECRET</code>) ne sont pas définis dans Vercel.
            </p>
          )}
        </div>
        {numbers.length > 0 && (
          <ul className="divide-y border rounded-xl text-sm">
            {numbers.map((n) => (
              <li key={n.phone_number_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong dir="ltr">{n.display_phone || "Numéro WhatsApp"}</strong> <span className="text-gray-500" dir="ltr">({n.phone_number_id})</span>
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.enabled ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{n.enabled ? "Activé" : "Désactivé"}</span>
              </li>
            ))}
          </ul>
        )}
        <form action={save} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
          <div>
            <label className="block text-sm font-bold mb-1">Identifiant du numéro (Meta)</label>
            <input name="phoneNumberId" placeholder="ex. 100000000000001" className={`${input} ${err("phoneNumberId") ? "border-red-400" : ""}`} autoComplete="off" dir="ltr" />
            {err("phoneNumberId") && <p className="text-xs text-red-600 mt-1">{err("phoneNumberId")}</p>}
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Numéro affiché (facultatif)</label>
            <input name="displayPhone" placeholder="+216 …" className={input} autoComplete="off" dir="ltr" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="enabled" /> Activer la réception pour ce numéro
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Submit />
            {state?.message && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</span>}
          </div>
        </form>
      </div>
    </section>
  )
}
