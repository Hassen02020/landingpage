"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveOfferAction } from "../../../../catalog-actions"
import { Field, inputCls } from "../../Field"
import type { Category, Offer } from "@/lib/server/catalog"

function Save() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  )
}

export function OfferForm({ offer, categories }: { offer: Offer | null; categories: Pick<Category, "id" | "name" | "product">[] }) {
  const [state, action] = useFormState(saveOfferAction, undefined)
  const e = (k: string) => state?.errors?.[k]
  const v = (x: unknown) => (x === null || x === undefined ? "" : String(x))
  return (
    <form action={action} className="space-y-5">
      {offer && <input type="hidden" name="id" value={offer.id} />}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border p-4 sticky top-16 z-20 lg:top-2">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="visible" defaultChecked={offer?.visible ?? false} className="w-4 h-4" /> Affichée sur le site
        </label>
        <div className="flex items-center gap-3">
          {state?.message && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</span>}
          <Save />
        </div>
      </div>

      <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Nom de l'offre *" error={e("name")} className="md:col-span-2"><input name="name" defaultValue={v(offer?.name)} required className={inputCls} /></Field>
        <Field label="SKU" error={e("sku")} help="ex. OMRA-1802"><input name="sku" defaultValue={v(offer?.sku)} className={`${inputCls} uppercase`} dir="ltr" /></Field>
        <Field label="Produit *" error={e("product")}>
          <select name="product" defaultValue={offer?.product ?? "omra"} className={inputCls}>
            <option value="omra">Omra</option><option value="voyage">Voyage organisé</option><option value="hotel">Promo hôtel</option><option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Catégorie (page publique)" error={e("category_id")}>
          <select name="category_id" defaultValue={offer?.category_id ?? ""} className={inputCls}>
            <option value="">Aucune</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Étiquette" help="ex. ⭐ الإقامة الأطول"><input name="tag" defaultValue={v(offer?.tag)} maxLength={40} className={inputCls} /></Field>
        <Field label="Destination"><input name="destination" defaultValue={v(offer?.destination)} className={inputCls} /></Field>
        <Field label="Date de départ" error={e("departure_date")}><input type="date" name="departure_date" defaultValue={v(offer?.departure_date)} className={inputCls} /></Field>
        <Field label="Nuits" error={e("nights")}><input name="nights" inputMode="numeric" defaultValue={v(offer?.nights)} className={inputCls} /></Field>
        <Field label="Détail des nuits" help="ex. 10 بمكة + 4 بالمدينة" className="md:col-span-3"><input name="nights_detail" defaultValue={v(offer?.nights_detail)} className={inputCls} /></Field>
      </section>

      <section className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-black">Prix et places</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Prix avant remise (barré)" error={e("price_before")}><input name="price_before" inputMode="decimal" defaultValue={v(offer?.price_before)} className={inputCls} /></Field>
          <Field label="Prix / personne (TND) *" error={e("price")}><input name="price" inputMode="decimal" required defaultValue={v(offer?.price)} className={inputCls} /></Field>
          <Field label="Coût / personne (TND)" error={e("cost")} help="Billet + hôtel + visa… jamais affiché au public"><input name="cost" inputMode="decimal" defaultValue={v(offer?.cost)} className={inputCls} /></Field>
          <Field label="Places totales" error={e("seats_total")} help="Vide = places non suivies"><input name="seats_total" inputMode="numeric" defaultValue={v(offer?.seats_total)} className={inputCls} /></Field>
          <Field label="Places vendues" error={e("seats_sold")} help="« بقي X أماكن » s'affiche à 10 places ou moins ; « مكتمل » à 0"><input name="seats_sold" inputMode="numeric" defaultValue={v(offer?.seats_sold ?? 0)} className={inputCls} /></Field>
          <Field label="Ordre d'affichage"><input name="position" inputMode="numeric" defaultValue={v(offer?.position ?? 0)} className={inputCls} /></Field>
        </div>
      </section>

      <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ce qui est inclus" help="Une ligne par élément (20 max)" className="md:col-span-2">
          <textarea name="features" rows={6} defaultValue={(offer?.features ?? []).join("\n")} className={inputCls} />
        </Field>
        <Field label="Description" className="md:col-span-2"><textarea name="description" rows={4} defaultValue={v(offer?.description)} className={inputCls} /></Field>
        <Field label="Image (JPG, PNG, WebP — 4 Mo max)" error={e("image_url")} help="800 × 600 conseillé">
          <input type="file" name="image_file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        </Field>
        <Field label="… ou lien d'image" help="https://… ou /fichier.jpg"><input name="image_url" defaultValue={v(offer?.image_url)} className={inputCls} dir="ltr" /></Field>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {offer?.image_url && <img src={offer.image_url} alt="" className="w-40 h-28 object-cover rounded-xl border" />}
      </section>
    </form>
  )
}
