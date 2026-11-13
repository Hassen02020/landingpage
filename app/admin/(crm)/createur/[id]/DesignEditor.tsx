"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { saveDesignAction, type DesignState } from "@/app/admin/createur-actions"
import { PRESETS, SECTION_LABELS, type PageDesign } from "@/lib/page-builder/design"

const inp = "w-full border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-violet-500"
const btn = "px-3 py-2 rounded-lg border text-sm font-bold min-h-[44px] bg-white hover:bg-gray-50"

function Save() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl min-h-[44px]" data-testid="save-design">{pending ? "Enregistrement…" : "Enregistrer la personnalisation"}</button>
}

/** Éditeur de personnalisation : l'aperçu (étape 5) montre exactement le résultat ; rien n'est publié tant que la page n'est pas publiée. */
export function DesignEditor({ id, initial, available }: { id: string; initial: PageDesign; available: boolean }) {
  const [d, setD] = useState<PageDesign>(initial)
  const [state, action] = useFormState<DesignState | undefined, FormData>(saveDesignAction, undefined)
  const errs = state?.errors ?? {}
  const move = (i: number, dir: -1 | 1) => setD((x) => { const s = x.sections.slice(); const j = i + dir; if (j < 0 || j >= s.length) return x; [s[i], s[j]] = [s[j], s[i]]; return { ...x, sections: s } })
  const upd = <K extends keyof PageDesign>(k: K, v: PageDesign[K]) => setD((x) => ({ ...x, [k]: v }))

  return (
    <form action={action} className="space-y-5" aria-label="Personnalisation de la page">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="design" value={JSON.stringify(d)} />
      {!available && <p role="status" className="rounded-xl p-3 text-sm bg-amber-50 text-amber-900 border border-amber-200" data-testid="design-unavailable">La personnalisation avancée sera disponible après l&apos;application de la migration 0018 (en attente d&apos;autorisation). Vous pouvez préparer vos choix, mais ils ne pourront pas être enregistrés pour l&apos;instant.</p>}

      <section className="bg-white rounded-2xl border p-5 space-y-4" aria-label="Couleurs et boutons">
        <h2 className="font-black">Couleurs, fond et boutons</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="font-bold">Couleur principale</span>
            <select value={d.colors.preset} onChange={(e) => upd("colors", { ...d.colors, preset: e.target.value })} className={`${inp} mt-1 bg-white`} aria-label="Couleur principale">
              {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="font-bold">Ou une couleur exacte (code #rrggbb)</span>
            <input value={d.colors.custom} onChange={(e) => upd("colors", { ...d.colors, custom: e.target.value })} placeholder="#1d4ed8" className={`${inp} mt-1 font-mono`} dir="ltr" aria-label="Couleur personnalisée" />
            {errs.custom && <span role="alert" className="text-red-700 text-xs">{errs.custom}</span>}
          </label>
          <label className="block text-sm"><span className="font-bold">Arrière-plan de la page</span>
            <select value={d.background} onChange={(e) => upd("background", e.target.value as PageDesign["background"])} className={`${inp} mt-1 bg-white`} aria-label="Arrière-plan">
              <option value="famille">Fond du modèle</option><option value="blanc">Blanc</option><option value="teinte">Teinte de votre couleur</option>
            </select>
          </label>
          <label className="block text-sm"><span className="font-bold">Texte du bouton principal (facultatif)</span>
            <input value={d.cta.label} maxLength={40} onChange={(e) => upd("cta", { ...d.cta, label: e.target.value })} placeholder="Réserver cette offre" className={`${inp} mt-1`} aria-label="Texte du bouton" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.cta.whatsapp} onChange={(e) => upd("cta", { ...d.cta, whatsapp: e.target.checked })} aria-label="Bouton WhatsApp en tête de page" /> Ajouter un bouton « Écrire sur WhatsApp » en tête de page</label>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.price.prefix} onChange={(e) => upd("price", { ...d.price, prefix: e.target.checked })} aria-label="Afficher À partir de" /> Afficher « À partir de … » (prix le plus bas) en tête de page</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.price.showBefore} onChange={(e) => upd("price", { ...d.price, showBefore: e.target.checked })} aria-label="Afficher le prix barré" /> Afficher l&apos;ancien prix barré lorsqu&apos;il existe</label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.form.email} onChange={(e) => upd("form", { email: e.target.checked })} aria-label="Demander l'e-mail dans le formulaire" /> Demander l&apos;e-mail dans le formulaire (facultatif pour le visiteur)</label>
        <p className="text-xs text-gray-500">Les prix et les dates viennent toujours de vos offres : ce réglage ne change que leur présentation.</p>
      </section>

      <section className="bg-white rounded-2xl border p-5 space-y-3" aria-label="Ordre des sections">
        <h2 className="font-black">Sections de la page</h2>
        <ol className="space-y-2" data-testid="section-order">
          {d.sections.map((s, i) => (
            <li key={s.key} data-section={s.key} className="flex items-center gap-2 border rounded-xl px-3 py-2">
              <span className="flex-1 font-bold text-sm">{SECTION_LABELS[s.key]}{s.key === "testimonials" && d.testimonials.length === 0 ? <span className="font-normal text-gray-500"> (s&apos;affiche dès qu&apos;un témoignage est saisi)</span> : null}</span>
              <label className="text-sm flex items-center gap-1"><input type="checkbox" disabled={s.key === "form"} checked={s.visible} onChange={(e) => upd("sections", d.sections.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} aria-label={`Afficher ${SECTION_LABELS[s.key]}`} /> Afficher</label>
              <button type="button" className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${SECTION_LABELS[s.key]}`}>↑</button>
              <button type="button" className={btn} onClick={() => move(i, 1)} disabled={i === d.sections.length - 1} aria-label={`Descendre ${SECTION_LABELS[s.key]}`}>↓</button>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-500">Une section sans contenu ne s&apos;affiche pas. Le formulaire de réservation reste toujours visible.</p>
      </section>

      <ListEditor title="Questions fréquentes" hint="Remplace les questions génériques. Ne promettez rien que vous ne pouvez pas tenir (prix, disponibilité)." testid="faq" errs={errs} errKey="faq"
        items={d.faq} blank={{ q: "", a: "" }} max={8} onChange={(v) => upd("faq", v)}
        fields={[["q", "Question", "input"], ["a", "Réponse", "textarea"]]} />
      <ListEditor title="Programme (étapes ou jours)" hint="Remplace le programme tiré des offres." testid="program" errs={errs} errKey="program"
        items={d.program} blank={{ title: "", text: "" }} max={14} onChange={(v) => upd("program", v)}
        fields={[["title", "Titre (ex. Jour 1)", "input"], ["text", "Description", "textarea"]]} />
      <ListEditor title="Témoignages" hint="Uniquement de vrais avis de clients que vous détenez. N'inventez jamais un témoignage." testid="testimonials" errs={errs} errKey="testimonial"
        items={d.testimonials} blank={{ name: "", text: "", place: "" }} max={6} onChange={(v) => upd("testimonials", v)}
        fields={[["name", "Nom du client", "input"], ["place", "Ville (facultatif)", "input"], ["text", "Témoignage", "textarea"]]} />

      {state?.message && <div role={state.ok ? "status" : "alert"} data-testid="design-message" className={`rounded-xl p-3 text-sm border ${state.ok ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>{state.message}</div>}
      <Save />
    </form>
  )
}

type Row = Record<string, string>
function ListEditor({ title, hint, items, blank, max, onChange, fields, testid, errs, errKey }: { title: string; hint: string; items: Row[]; blank: Row; max: number; onChange: (v: never) => void; fields: [string, string, "input" | "textarea"][]; testid: string; errs: Record<string, string>; errKey: string }) {
  const set = (v: Row[]) => (onChange as (v: Row[]) => void)(v)
  return (
    <section className="bg-white rounded-2xl border p-5 space-y-3" aria-label={title} data-testid={`list-${testid}`}>
      <h2 className="font-black">{title}</h2>
      <p className="text-xs text-gray-500">{hint}</p>
      {errs[errKey] && <p role="alert" className="text-red-700 text-xs">{errs[errKey]}</p>}
      {items.map((it, i) => (
        <div key={i} className="border rounded-xl p-3 space-y-2" data-row={testid}>
          {fields.map(([k, label, kind]) => (
            <label key={k} className="block text-sm"><span className="font-bold">{label}</span>
              {kind === "input"
                ? <input value={it[k] ?? ""} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} className={`${inp} mt-1`} aria-label={`${title} — ${label} ${i + 1}`} />
                : <textarea value={it[k] ?? ""} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} rows={3} className={`${inp} mt-1`} aria-label={`${title} — ${label} ${i + 1}`} />}
            </label>
          ))}
          {(errs[`${errKey}${i}`]) && <p role="alert" className="text-red-700 text-xs">{errs[`${errKey}${i}`]}</p>}
          <button type="button" className={btn} onClick={() => set(items.filter((_, j) => j !== i))}>Supprimer</button>
        </div>
      ))}
      {items.length < max && <button type="button" className={btn} onClick={() => set([...items, { ...blank }])}>+ Ajouter</button>}
    </section>
  )
}
