"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveTemplateAction } from "../../team-actions"
import type { Template } from "@/lib/server/templates"

function Save() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="bg-violet-700 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
}

export function TemplateForm({ t }: { t?: Template }) {
  const [state, action] = useFormState(saveTemplateAction, undefined)
  const e = state?.errors ?? {}
  return (
    <form action={action} className="space-y-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input name="title" defaultValue={t?.title} placeholder="Titre (ex. Relance Omra)" className="border rounded-xl px-3 py-2 sm:col-span-2" />
        <select name="product" defaultValue={t?.product ?? ""} className="border rounded-xl px-3 py-2">
          <option value="">Tous les produits</option><option value="omra">Omra</option><option value="voyage">Voyage organisé</option><option value="hotel">Promo hôtel</option>
        </select>
        <input name="position" defaultValue={t?.position ?? 0} inputMode="numeric" placeholder="Ordre" className="border rounded-xl px-3 py-2" />
      </div>
      {e.title && <p className="text-xs text-red-600">{e.title}</p>}
      <textarea name="body" defaultValue={t?.body} rows={4} placeholder="Message… variables : {prenom} {nom} {ref} {offre} {produit}" className="w-full border rounded-xl px-3 py-2" />
      {e.body && <p className="text-xs text-red-600">{e.body}</p>}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={t?.active ?? true} /> Actif</label>
        <div className="flex items-center gap-3">
          {state?.message && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</span>}
          <Save />
        </div>
      </div>
    </form>
  )
}
