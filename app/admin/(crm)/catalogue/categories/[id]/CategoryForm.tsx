"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveCategoryAction } from "../../../../catalog-actions"
import { Field, inputCls } from "../../Field"
import type { Category } from "@/lib/server/catalog"

function Save() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  )
}

export function CategoryForm({ category }: { category: Category | null }) {
  const [state, action] = useFormState(saveCategoryAction, undefined)
  const e = (k: string) => state?.errors?.[k]
  const v = (x: unknown) => (x === null || x === undefined ? "" : String(x))
  return (
    <form action={action} className="space-y-5">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border p-4 sticky top-16 z-20">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="visible" defaultChecked={category?.visible ?? false} className="w-4 h-4" /> Affichée (page publique en ligne)
        </label>
        <div className="flex items-center gap-3">
          {state?.message && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</span>}
          <Save />
        </div>
      </div>
      <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Nom de la catégorie *" error={e("name")} className="md:col-span-2"><input name="name" defaultValue={v(category?.name)} required className={inputCls} /></Field>
        <Field label="Adresse de la page" error={e("slug")} help="ex. turquie-ete-2027 → /c/turquie-ete-2027 (vide = d'après le nom)"><input name="slug" defaultValue={v(category?.slug)} className={inputCls} dir="ltr" /></Field>
        <Field label="Produit *" error={e("product")}>
          <select name="product" defaultValue={category?.product ?? "voyage"} className={inputCls}>
            <option value="omra">Omra</option><option value="voyage">Voyage organisé</option><option value="hotel">Promo hôtel</option><option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Langue de la page">
          <select name="lang" defaultValue={category?.lang ?? "fr"} className={inputCls}><option value="fr">Français</option><option value="ar">Arabe</option></select>
        </Field>
        <Field label="Ordre"><input name="position" inputMode="numeric" defaultValue={v(category?.position ?? 0)} className={inputCls} /></Field>
        <Field label="Accroche" className="md:col-span-3"><input name="headline" defaultValue={v(category?.headline)} maxLength={160} className={inputCls} /></Field>
        <Field label="Description" className="md:col-span-3"><textarea name="description" rows={3} defaultValue={v(category?.description)} className={inputCls} /></Field>
      </section>
      <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="font-black md:col-span-2">Bannières</h2>
        <Field label="Ordinateur (1600 × 500)" error={e("banner_desktop")}><input type="file" name="banner_desktop_file" accept="image/jpeg,image/png,image/webp" className="text-sm" /></Field>
        <Field label="Mobile (480 × 360)" error={e("banner_mobile")}><input type="file" name="banner_mobile_file" accept="image/jpeg,image/png,image/webp" className="text-sm" /></Field>
        <Field label="… ou lien (ordinateur)"><input name="banner_desktop" defaultValue={v(category?.banner_desktop)} className={inputCls} dir="ltr" /></Field>
        <Field label="… ou lien (mobile)"><input name="banner_mobile" defaultValue={v(category?.banner_mobile)} className={inputCls} dir="ltr" /></Field>
      </section>
      <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 gap-4">
        <h2 className="font-black">Référencement (SEO)</h2>
        <p className="text-sm text-gray-600 -mt-2">Apparence dans Google et lors du partage sur Facebook / WhatsApp. Vide = nom et accroche.</p>
        <Field label="Titre SEO (70 max)" error={e("seo_title")}><input name="seo_title" defaultValue={v(category?.seo_title)} maxLength={70} className={inputCls} /></Field>
        <Field label="Description SEO (160 max)" error={e("seo_description")}><textarea name="seo_description" rows={2} defaultValue={v(category?.seo_description)} maxLength={160} className={inputCls} /></Field>
      </section>
    </form>
  )
}
