"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveMetaPageAction } from "../../meta-pages-actions"
import type { MetaPageView } from "@/lib/server/meta-pages"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60">
      {pending ? "…" : "Enregistrer"}
    </button>
  )
}

export function MetaLeadsCard({ pages, webhookUrl, webhookReady, migrationApplied }: { pages: MetaPageView[]; webhookUrl: string; webhookReady: boolean; migrationApplied: boolean }) {
  const [state, save] = useFormState(saveMetaPageAction, undefined)
  const input = "w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const err = (k: string) => state?.errors?.[k]
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-2">
      <div className="bg-gradient-to-br from-blue-100 to-blue-50 px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-gray-900">Meta — formulaires instantanés (Facebook / Instagram)</h2>
          <p className="text-xs text-gray-600">Les prospects des formulaires instantanés arrivent seuls dans le CRM, sans import.</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${webhookReady ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{webhookReady ? "Réception prête" : "Réception inactive"}</span>
      </div>
      <div className="p-5 space-y-4">
        {!migrationApplied && <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">La migration 0015 n&apos;est pas encore appliquée dans Supabase : cette carte est en lecture seule.</p>}
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            Adresse du webhook à saisir dans l&apos;application Meta : <code className="bg-gray-50 border rounded px-1.5 py-0.5 text-xs break-all select-all" dir="ltr">{webhookUrl}</code>
          </p>
          {!webhookReady && <p className="text-amber-800">La réception reste inactive tant que les variables <code>META_APP_SECRET</code> et <code>META_LEADS_VERIFY_TOKEN</code> ne sont pas définies dans Vercel.</p>}
        </div>

        {pages.length > 0 && (
          <ul className="divide-y border rounded-xl text-sm">
            {pages.map((p) => (
              <li key={p.page_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{p.page_name || "Page Facebook"}</strong> <span className="text-gray-500" dir="ltr">({p.page_id})</span> — jeton ••••{p.token_last4}
                </span>
                <span className="flex gap-2 text-xs font-bold">
                  <span className={`px-2 py-0.5 rounded-full ${p.enabled ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{p.enabled ? "Activée" : "Désactivée"}</span>
                  <span className={`px-2 py-0.5 rounded-full ${p.consent_confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{p.consent_confirmed ? "Accord confirmé" : "Accord non confirmé"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form action={save} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
          <div>
            <label className="block text-sm font-bold mb-1">Identifiant de la page</label>
            <input name="pageId" placeholder="ex. 100000000000001" className={`${input} ${err("pageId") ? "border-red-400" : ""}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
            {err("pageId") && <p className="text-xs text-red-600 mt-1">{err("pageId")}</p>}
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Nom de la page (facultatif)</label>
            <input name="pageName" className={input} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold mb-1">Jeton d&apos;accès de la page</label>
            <input name="token" type="password" placeholder="Commence par « EAA » — vide pour garder le jeton enregistré" className={`${input} ${err("token") ? "border-red-400" : ""}`} autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" spellCheck={false} />
            {err("token") && <p className="text-xs text-red-600 mt-1">{err("token")}</p>}
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="consentConfirmed" className="mt-1" />
            <span>Je confirme que le formulaire instantané demande à la personne l&apos;accord d&apos;être recontactée. Sans cette confirmation, aucun prospect de cette page n&apos;est enregistré.</span>
          </label>
          {err("consentConfirmed") && <p className="text-xs text-red-600 sm:col-span-2">{err("consentConfirmed")}</p>}
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" name="enabled" /> Activer la réception pour cette page
          </label>
          {state?.message && (
            <div className={`sm:col-span-2 p-3 rounded-xl text-sm border ${state.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>{state.message}</div>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <Submit />
          </div>
        </form>
      </div>
    </section>
  )
}
