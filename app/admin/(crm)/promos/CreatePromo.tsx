"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createPromoAction } from "../../settings-actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50">
      {pending ? "…" : "Créer le code"}
    </button>
  )
}

// défini hors du composant : les champs gardent leur saisie quand une erreur s'affiche
function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-bold">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function CreatePromo() {
  const [state, action] = useFormState(createPromoAction, undefined)
  const e = (k: string) => state?.errors?.[k]
  const input = "w-full border rounded-xl px-3 py-2"
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <F error={e("code")} label="Code *"><input name="code" required placeholder="RAMADAN27" className={`${input} uppercase`} dir="ltr" maxLength={32} /></F>
      <F error={e("title")} label="Titre *"><input name="title" required placeholder="Remise Ramadan" className={input} maxLength={120} /></F>
      <F error={e("discountType")} label="Type *">
        <select name="discountType" className={input} defaultValue="percent">
          <option value="percent">Pourcentage (%)</option>
          <option value="amount">Montant (TND)</option>
        </select>
      </F>
      <F error={e("discountValue")} label="Valeur *"><input name="discountValue" required inputMode="decimal" placeholder="10" className={input} /></F>
      <F error={e("product")} label="Produit">
        <select name="product" className={input} defaultValue="">
          <option value="">Tous les produits</option>
          <option value="omra">Omra</option>
          <option value="voyage">Voyage organisé</option>
          <option value="hotel">Promo hôtel</option>
        </select>
      </F>
      <F error={e("startsOn")} label="Début"><input type="date" name="startsOn" className={input} /></F>
      <F error={e("endsOn")} label="Fin"><input type="date" name="endsOn" className={input} /></F>
      <F error={e("maxUses")} label="Utilisations max."><input name="maxUses" inputMode="numeric" placeholder="illimité" className={input} /></F>
      <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-3">
        <p className={`text-sm ${state?.ok ? "text-green-700" : "text-red-700"}`}>{state?.message}</p>
        <Submit />
      </div>
    </form>
  )
}
