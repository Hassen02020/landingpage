"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { saveDraftAction } from "@/app/admin/createur-actions"
import { Field, inputCls } from "../../catalogue/Field"
import { OFFER_FIELD_LABELS, type OfferField, type Theme } from "@/lib/page-builder/themes"
import { slugify } from "@/lib/catalog-slug"
import type { Category, Offer } from "@/lib/server/catalog"

type Row = { key: number; id?: string; removed: boolean; v: Record<string, string>; features: string; image: string }
const v = (x: unknown) => (x === null || x === undefined ? "" : String(x))
const toRow = (o: Offer, key: number): Row => ({
  key, id: o.id, removed: false, image: v(o.image_url), features: (o.features ?? []).join("\n"),
  v: { name: v(o.name), destination: v(o.destination), departure_date: v(o.departure_date), nights: v(o.nights), nights_detail: v(o.nights_detail), price: v(o.price), price_before: v(o.price_before), seats_total: v(o.seats_total), tag: v(o.tag), description: v(o.description) },
})
const emptyRow = (key: number, theme: Theme): Row => ({ key, removed: false, image: "", features: "", v: { name: "", destination: theme.id === "turquie" ? "Turquie" : "", departure_date: "", nights: "", nights_detail: "", price: "", price_before: "", seats_total: "", tag: "", description: "" } })

function SaveButtons({ canContinue }: { canContinue: boolean }) {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={pending} className="border border-violet-700 text-violet-800 font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
      {canContinue && <button type="submit" name="next" value="formulaire" disabled={pending} className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">Enregistrer et continuer →</button>}
    </div>
  )
}

export function PageEditor({ theme, category, offers, slugLock }: { theme: Theme; category: Category | null; offers: Offer[]; slugLock: { locked: boolean; message?: string } }) {
  const [state, action] = useFormState(saveDraftAction, undefined)
  const [tab, setTab] = useState<"infos" | "perso">("infos")
  const [name, setName] = useState(category?.name ?? "")
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [rows, setRows] = useState<Row[]>(() => (offers.length ? offers.map(toRow) : [emptyRow(0, theme)]))
  const e = (k: string) => state?.errors?.[k]
  const has = (f: OfferField) => theme.offerFields.includes(f)
  const req = (f: OfferField) => f === "name" || f === "price" || theme.offerRequired.includes(f)
  const lbl = (f: OfferField) => `${OFFER_FIELD_LABELS[f]}${req(f) ? " *" : ""}`
  const setField = (key: number, k: string, val: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, v: { ...r.v, [k]: val } } : r)))
  const nextKey = rows.reduce((m, r) => Math.max(m, r.key), -1) + 1
  const visibleRows = rows.filter((r) => !(r.removed && !r.id))
  const tabBtn = (id: "infos" | "perso", text: string) => (
    <button type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === id ? "bg-violet-700 text-white" : "bg-white border hover:bg-gray-50"}`}>{text}</button>
  )

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="theme" value={theme.id} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="offer_count" value={rows.length} />
      <div className="flex flex-wrap gap-2">{tabBtn("infos", "2. Informations du produit")}{tabBtn("perso", "3. Personnalisation de la page")}</div>
      {state?.message && <div role="status" className={`rounded-xl p-3 text-sm ${state.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>{state.message}</div>}

      <div className={tab === "infos" ? "space-y-5" : "hidden"}>
        <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 gap-4">
          <h2 className="font-black">Le produit</h2>
          <Field label="Nom de la page *" error={e("name")} help="Titre principal de la page publique."><input name="name" value={name} onChange={(ev) => setName(ev.target.value)} required maxLength={120} className={inputCls} placeholder={theme.hints.name} /></Field>
          <Field label="Argument commercial (accroche) *" error={e("headline")} help="Une phrase (160 caractères max) qui donne envie de réserver."><input name="headline" defaultValue={v(category?.headline)} maxLength={160} className={inputCls} placeholder={theme.hints.headline} /></Field>
          <Field label="Présentation du produit *" error={e("description")} help="Décrivez le produit tel qu'il est : aucune promesse inventée."><textarea name="description" rows={4} maxLength={2000} defaultValue={v(category?.description)} className={inputCls} placeholder="Présentez le produit en quelques lignes." /></Field>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-black">Offres, prix et dates</h2><span className="text-xs text-gray-500">{visibleRows.filter((r) => !r.removed).length} / 10</span></div>
          {rows.map((r, i) => {
            if (r.removed && !r.id) return null
            const n = (k: string) => `o${i}_${k}`
            return (
              <fieldset key={r.key} className={`bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-3 gap-4 ${r.removed ? "opacity-50" : ""}`} data-offer={i}>
                <legend className="px-2 font-bold text-sm">Offre {i + 1}</legend>
                {r.id && <input type="hidden" name={n("id")} value={r.id} />}
                <input type="hidden" name={n("remove")} value={r.removed ? "1" : "0"} />
                <input type="hidden" name={n("image_url")} value={r.image} />
                {has("name") && <Field label={lbl("name")} error={e(n("name"))} className="md:col-span-2"><input name={n("name")} value={r.v.name} onChange={(ev) => setField(r.key, "name", ev.target.value)} maxLength={120} className={inputCls} placeholder={theme.hints.name} /></Field>}
                {has("tag") && <Field label={lbl("tag")} error={e(n("tag"))}><input name={n("tag")} value={r.v.tag} onChange={(ev) => setField(r.key, "tag", ev.target.value)} maxLength={40} className={inputCls} /></Field>}
                {has("destination") && <Field label={lbl("destination")} error={e(n("destination"))}><input name={n("destination")} value={r.v.destination} onChange={(ev) => setField(r.key, "destination", ev.target.value)} maxLength={120} className={inputCls} placeholder={theme.hints.destination} /></Field>}
                {has("departure_date") && <Field label={lbl("departure_date")} error={e(n("departure_date"))}><input type="date" name={n("departure_date")} value={r.v.departure_date} onChange={(ev) => setField(r.key, "departure_date", ev.target.value)} className={inputCls} /></Field>}
                {has("nights") && <Field label={lbl("nights")} error={e(n("nights"))}><input name={n("nights")} inputMode="numeric" value={r.v.nights} onChange={(ev) => setField(r.key, "nights", ev.target.value)} className={inputCls} /></Field>}
                {has("nights_detail") && <Field label={lbl("nights_detail")} error={e(n("nights_detail"))} className="md:col-span-2"><input name={n("nights_detail")} value={r.v.nights_detail} onChange={(ev) => setField(r.key, "nights_detail", ev.target.value)} maxLength={160} className={inputCls} /></Field>}
                {has("price") && <Field label={lbl("price")} error={e(n("price"))}><input name={n("price")} inputMode="decimal" value={r.v.price} onChange={(ev) => setField(r.key, "price", ev.target.value)} className={inputCls} /></Field>}
                {has("price_before") && <Field label={lbl("price_before")} error={e(n("price_before"))}><input name={n("price_before")} inputMode="decimal" value={r.v.price_before} onChange={(ev) => setField(r.key, "price_before", ev.target.value)} className={inputCls} /></Field>}
                {has("seats_total") && <Field label={lbl("seats_total")} error={e(n("seats_total"))} help="Vide = aucune rareté affichée."><input name={n("seats_total")} inputMode="numeric" value={r.v.seats_total} onChange={(ev) => setField(r.key, "seats_total", ev.target.value)} className={inputCls} /></Field>}
                {has("features") && <Field label={lbl("features")} help="Une prestation par ligne (20 max). Seulement ce qui est réellement inclus." className="md:col-span-3"><textarea name={n("features")} rows={4} value={r.features} onChange={(ev) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, features: ev.target.value } : x)))} className={inputCls} placeholder={theme.hints.features} /></Field>}
                {has("description") && <Field label={lbl("description")} error={e(n("description"))} className="md:col-span-3"><textarea name={n("description")} rows={4} maxLength={4000} value={r.v.description} onChange={(ev) => setField(r.key, "description", ev.target.value)} className={inputCls} placeholder={theme.hints.description} /></Field>}
                {has("image_url") && (
                  <Field label={lbl("image_url")} error={e(n("image_url"))} className="md:col-span-3" help="JPG, PNG ou WebP, 4 Mo maximum.">
                    <div className="flex items-center gap-3">
                      {r.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="h-14 w-20 object-cover rounded-lg border" />}
                      <input type="file" name={n("image_file")} accept="image/jpeg,image/png,image/webp" className="text-sm" />
                    </div>
                  </Field>
                )}
                <div className="md:col-span-3 flex justify-end">
                  <button type="button" className="text-sm font-bold text-red-700 hover:underline" onClick={() => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, removed: !x.removed } : x)).filter((x) => !(x.removed && !x.id)))}>
                    {r.removed ? "Annuler la suppression" : "Retirer cette offre"}
                  </button>
                </div>
              </fieldset>
            )
          })}
          {rows.length < 10 && <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow(nextKey, theme)])} className="bg-white border-2 border-dashed rounded-2xl px-5 py-3 font-bold text-violet-800 hover:bg-violet-50 w-full">+ Ajouter une offre (un autre départ, une autre formule)</button>}
        </section>
      </div>

      <div className={tab === "perso" ? "space-y-5" : "hidden"}>
        <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="font-black md:col-span-2">Adresse et langue</h2>
          <Field label="Adresse de la page" error={e("slug")} help={slugLock.locked ? slugLock.message : `Publiée sur /c/${slug || slugify(name) || "…"} — fixée après publication.`}>
            <input name="slug" value={slug} onChange={(ev) => setSlug(ev.target.value)} readOnly={slugLock.locked} placeholder={slugify(name) || "d'après le nom"} className={`${inputCls} ${slugLock.locked ? "bg-gray-100 text-gray-500" : ""}`} dir="ltr" />
          </Field>
          <Field label="Langue de la page publique" help="Le français et l'arabe (écriture de droite à gauche) sont disponibles.">
            <select name="lang" defaultValue={category?.lang ?? theme.lang} className={inputCls}><option value="fr">Français</option><option value="ar">العربية (arabe, RTL)</option></select>
          </Field>
        </section>
        <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="font-black md:col-span-2">Bannière principale</h2>
          {(["banner_desktop", "banner_mobile"] as const).map((k) => (
            <Field key={k} label={k === "banner_desktop" ? "Ordinateur (1600 × 500)" : "Mobile (800 × 600)"} error={e(k)} help="JPG, PNG ou WebP, 4 Mo maximum.">
              <div className="flex items-center gap-3">
                <input type="hidden" name={k} defaultValue={v(category?.[k])} />
                {category?.[k] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={category[k]!} alt="" className="h-14 w-24 object-cover rounded-lg border" />}
                <input type="file" name={`${k}_file`} accept="image/jpeg,image/png,image/webp" className="text-sm" />
              </div>
            </Field>
          ))}
        </section>
        <section className="bg-white rounded-2xl border p-5 grid grid-cols-1 gap-4">
          <h2 className="font-black">Référencement (moteurs de recherche)</h2>
          <Field label="Titre (70 caractères max)" error={e("seo_title")}><input name="seo_title" defaultValue={v(category?.seo_title)} maxLength={70} className={inputCls} /></Field>
          <Field label="Description (160 caractères max)" error={e("seo_description")}><input name="seo_description" defaultValue={v(category?.seo_description)} maxLength={160} className={inputCls} /></Field>
        </section>
        <p className="text-xs text-gray-500 bg-gray-50 border rounded-xl p-3">Couleurs, ordre des sections, galerie libre, FAQ et conditions personnalisées ne sont pas encore modifiables : la page prend l&apos;apparence de sa famille et affiche automatiquement les sections pour lesquelles vous avez saisi des informations.</p>
      </div>

      <SaveButtons canContinue />
    </form>
  )
}
