"use client"

import { useState } from "react"
import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { saveDesignAction, type DesignState } from "@/app/admin/createur-actions"
import { BLOCK_TYPES, PRESETS, sectionLabel, type BlockType, type DesignBlock, type PageDesign } from "@/lib/page-builder/design"
import { MediaPicker } from "./PageEditor"
import type { MediaEntry } from "@/lib/server/page-builder"

const inp = "w-full border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-violet-500"
const btn = "px-3 py-2 rounded-lg border text-sm font-bold min-h-[44px] bg-white hover:bg-gray-50"

function Save() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl min-h-[44px]" data-testid="save-design">{pending ? "Enregistrement…" : "Enregistrer la personnalisation"}</button>
}

/** Éditeur de personnalisation : l'aperçu (étape 5) montre exactement le résultat ; rien n'est publié tant que la page n'est pas publiée. */
export function DesignEditor({ id, initial, available, theme, media = [] }: { id: string; initial: PageDesign; available: boolean; theme: string; media?: MediaEntry[] }) {
  const [d, setD] = useState<PageDesign>(initial)
  const [state, action] = useFormState<DesignState | undefined, FormData>(saveDesignAction, undefined)
  const errs = state?.errors ?? {}
  const move = (i: number, dir: -1 | 1) => setD((x) => { const s = x.sections.slice(); const j = i + dir; if (j < 0 || j >= s.length) return x; [s[i], s[j]] = [s[j], s[i]]; return { ...x, sections: s } })
  const newId = () => "b" + Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "x").padEnd(5, "x")
  const addBlock = (type: BlockType) => setD((x) => {
    const block: DesignBlock = { id: newId(), type, title: "", text: "", items: type === "benefits" || type === "steps" ? [{ title: "", text: "" }] : [], images: type === "video" ? ["/omra-ramadan-complet-poster.jpg"] : [], cta: "form", ctaLabel: type === "cta" ? "Réserver" : "", video: type === "video" ? "/omra-ramadan-complet.mp4" : "" }
    const sections = x.sections.slice(); const at = sections.findIndex((s) => s.key === "faq"); const i = at >= 0 ? at : Math.max(0, sections.length - 1)
    sections.splice(i, 0, { key: `block:${block.id}`, visible: true })
    return { ...x, blocks: [...x.blocks, block], sections }
  })
  const updBlock = (bid: string, patch: Partial<DesignBlock>) => setD((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }))
  const removeBlock = (bid: string) => setD((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== bid), sections: x.sections.filter((s) => s.key !== `block:${bid}`) }))
  const [newType, setNewType] = useState<BlockType>("text")
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
        <label className="flex items-center gap-2 text-sm">En-tête de la page
          <select value={d.hero} onChange={(e) => upd("hero", e.target.value === "split" ? "split" : "standard")} className={`${inp} max-w-xs`} aria-label="Mise en page de l'en-tête">
            <option value="standard">Standard (bandeau)</option>
            <option value="split">Texte + vidéo verticale (fond clair)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.form.email} onChange={(e) => upd("form", { ...d.form, email: e.target.checked })} aria-label="Demander l'e-mail dans le formulaire" /> Demander l&apos;e-mail dans le formulaire (facultatif pour le visiteur)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.form.age === true} onChange={(e) => upd("form", { ...d.form, age: e.target.checked })} aria-label="Demander la tranche d'âge dans le formulaire" data-testid="age-checkbox" /> Demander la tranche d&apos;âge (facultatif, déclarée par le visiteur : n&apos;activez qu&apos;après validation du texte d&apos;information)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.form.region} onChange={(e) => upd("form", { ...d.form, region: e.target.checked })} aria-label="Demander la région dans le formulaire" /> Demander la région dans le formulaire (liste de gouvernorats, facultatif pour le visiteur)</label>
        <p className="text-xs text-gray-500">Les prix et les dates viennent toujours de vos offres : ce réglage ne change que leur présentation.</p>
      </section>

      <section className="bg-white rounded-2xl border p-5 space-y-3" aria-label="Ordre des sections">
        <h2 className="font-black">Sections de la page</h2>
        <ol className="space-y-2" data-testid="section-order">
          {d.sections.map((s, i) => (
            <li key={s.key} data-section={s.key} className="flex items-center gap-2 border rounded-xl px-3 py-2">
              <span className="flex-1 font-bold text-sm">{sectionLabel(d, s.key)}{s.key === "testimonials" && d.testimonials.length === 0 ? <span className="font-normal text-gray-500"> (s&apos;affiche dès qu&apos;un témoignage est saisi)</span> : null}</span>
              <label className="text-sm flex items-center gap-1"><input type="checkbox" disabled={s.key === "form"} checked={s.visible} onChange={(e) => upd("sections", d.sections.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} aria-label={`Afficher ${sectionLabel(d, s.key)}`} /> Afficher</label>
              <button type="button" className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${sectionLabel(d, s.key)}`}>↑</button>
              <button type="button" className={btn} onClick={() => move(i, 1)} disabled={i === d.sections.length - 1} aria-label={`Descendre ${sectionLabel(d, s.key)}`}>↓</button>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-500">Une section sans contenu ne s&apos;affiche pas. Le formulaire de réservation reste toujours visible.</p>
      </section>

      <section className="bg-white rounded-2xl border p-5 space-y-4" aria-label="Blocs personnalisés" data-testid="blocks-editor">
        <h2 className="font-black">Blocs personnalisés</h2>
        <p className="text-xs text-gray-500">Ajoutez vos propres sections (texte, avantages, étapes, galerie, image et texte, appel à l&apos;action, encadré) puis placez-les avec « Sections de la page ». Texte réel uniquement. {d.blocks.length}/12.</p>
        {errs.blocks && <p role="alert" className="text-red-700 text-xs">{errs.blocks}</p>}
        {d.blocks.map((b, i) => (
          <div key={b.id} className="border rounded-xl p-4 space-y-3" data-block-editor={b.type} data-testid="block-editor">
            <div className="flex items-center justify-between gap-2"><span className="font-bold text-sm">{BLOCK_TYPES[b.type].label}</span><button type="button" className={btn} onClick={() => removeBlock(b.id)} aria-label={`Supprimer le bloc ${i + 1}`}>Supprimer</button></div>
            <label className="block text-sm"><span className="font-bold">Titre</span><input value={b.title} maxLength={120} onChange={(e) => updBlock(b.id, { title: e.target.value })} className={`${inp} mt-1`} aria-label={`Bloc ${i + 1} — titre`} /></label>
            {(b.type === "text" || b.type === "image_text" || b.type === "notice" || b.type === "cta" || b.type === "video") && (
              <label className="block text-sm"><span className="font-bold">{b.type === "cta" ? "Message (facultatif)" : b.type === "video" ? "Légende (facultatif)" : "Texte"}</span><textarea value={b.text} rows={3} maxLength={1200} onChange={(e) => updBlock(b.id, { text: e.target.value })} className={`${inp} mt-1`} aria-label={`Bloc ${i + 1} — texte`} /></label>
            )}
            {(b.type === "benefits" || b.type === "steps") && (
              <div className="space-y-2">
                {b.items.map((it, j) => (
                  <div key={j} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-start">
                    <input value={it.title} maxLength={80} onChange={(e) => updBlock(b.id, { items: b.items.map((x, k) => (k === j ? { ...x, title: e.target.value } : x)) })} placeholder="Titre" className={inp} aria-label={`Bloc ${i + 1} — élément ${j + 1} titre`} />
                    <textarea value={it.text} rows={2} maxLength={400} onChange={(e) => updBlock(b.id, { items: b.items.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })} placeholder="Texte (facultatif)" className={inp} aria-label={`Bloc ${i + 1} — élément ${j + 1} texte`} />
                    <button type="button" className={btn} onClick={() => updBlock(b.id, { items: b.items.filter((_, k) => k !== j) })} aria-label={`Retirer l'élément ${j + 1}`}>✕</button>
                  </div>
                ))}
                {b.items.length < 12 && <button type="button" className={btn} onClick={() => updBlock(b.id, { items: [...b.items, { title: "", text: "" }] })}>+ Ajouter un élément</button>}
              </div>
            )}
            {b.type === "video" && (
              <label className="block text-sm"><span className="font-bold">Fichier vidéo du site</span><input value={b.video} maxLength={200} dir="ltr" onChange={(e) => updBlock(b.id, { video: e.target.value })} placeholder="/omra-ramadan-2027.mp4" className={`${inp} mt-1`} aria-label={`Bloc ${i + 1} — fichier vidéo`} /><span className="text-xs text-gray-500">Chemin d&apos;un fichier .mp4 ou .webm déjà présent dans le dossier public du site (pas d&apos;adresse externe).</span></label>
            )}
            {(b.type === "gallery" || b.type === "image_text" || b.type === "video") && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">{b.images.map((u) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-16 w-24 object-cover rounded-lg border" />
                    <button type="button" onClick={() => updBlock(b.id, { images: b.images.filter((x) => x !== u) })} className="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 text-xs" aria-label="Retirer l'image">✕</button>
                  </div>))}</div>
                {b.images.length === 0 && <p className="text-xs text-gray-500">Aucune image : choisissez-en une dans la médiathèque.</p>}
                {(b.type === "gallery" ? b.images.length < 8 : b.images.length < 1) && (
                  <MediaPicker media={media} label="Choisir une image de la médiathèque" onPick={(url) => updBlock(b.id, { images: b.images.includes(url) ? b.images : [...b.images, url] })} />
                )}
              </div>
            )}
            {b.type === "cta" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="font-bold">Texte du bouton</span><input value={b.ctaLabel} maxLength={40} onChange={(e) => updBlock(b.id, { ctaLabel: e.target.value })} className={`${inp} mt-1`} aria-label={`Bloc ${i + 1} — texte du bouton`} /></label>
                <label className="block text-sm"><span className="font-bold">Le bouton mène à</span><select value={b.cta} onChange={(e) => updBlock(b.id, { cta: e.target.value as "form" | "whatsapp" })} className={`${inp} mt-1 bg-white`} aria-label={`Bloc ${i + 1} — destination du bouton`}><option value="form">Le formulaire de réservation</option><option value="whatsapp">WhatsApp</option></select></label>
              </div>
            )}
            {errs[`block${i}`] && <p role="alert" className="text-red-700 text-xs">{errs[`block${i}`]}</p>}
          </div>
        ))}
        {d.blocks.length < 12 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm"><span className="font-bold block">Type de bloc</span>
              <select value={newType} onChange={(e) => setNewType(e.target.value as BlockType)} className={`${inp} bg-white min-w-[220px]`} aria-label="Type de bloc à ajouter">
                {(Object.keys(BLOCK_TYPES) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_TYPES[t].label}</option>)}
              </select>
            </label>
            <button type="button" className={btn} onClick={() => addBlock(newType)} data-testid="add-block">+ Ajouter ce bloc</button>
            <p className="w-full text-xs text-gray-500">{BLOCK_TYPES[newType].hint}</p>
          </div>
        )}
      </section>

      {d.sections.some((x) => x.key === "services") && (
        <>
          <ListEditor title="Services inclus (cartes)" hint="Ce que le programme comprend (vol, visa, encadrement, hôtel…). Texte réel uniquement." testid="services" errs={errs} errKey="services"
            items={d.services} blank={{ title: "", text: "" }} max={6} onChange={(v) => upd("services", v)}
            fields={[["title", "Titre", "input"], ["text", "Description", "textarea"]]} />
          <ListEditor title="Avantages et conditions" hint="Par exemple une réduction famille ou la marche à suivre pour les groupes : affichés tels quels, sans calcul." testid="conditions" errs={errs} errKey="conditions"
            items={d.conditions} blank={{ title: "", text: "" }} max={4} onChange={(v) => upd("conditions", v)}
            fields={[["title", "Titre", "input"], ["text", "Texte", "textarea"]]} />
        </>
      )}
      <section className="bg-white rounded-2xl border p-5 space-y-2" aria-label="Date limite de l'offre" data-testid="deadline-block">
        <h2 className="font-black">Date limite de l&apos;offre (compte à rebours)</h2>
        <input type="date" value={d.deadline} onChange={(e) => upd("deadline", e.target.value)} className={`${inp} max-w-xs`} aria-label="Date limite de l'offre" />
        {errs.deadline && <span role="alert" className="text-red-700 text-xs block">{errs.deadline}</span>}
        <p className="text-xs text-gray-500">Un compte à rebours s&apos;affiche en haut de la page jusqu&apos;à cette date, puis disparaît. Il ne modifie pas vos offres. Laissez vide pour ne rien afficher.</p>
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
      <div className="flex flex-wrap items-center gap-3"><Save /><Link href={`/admin/createur/${id}?etape=formulaire&theme=${theme}`} className="px-5 py-3 rounded-xl border font-bold min-h-[44px] bg-white">Continuer vers le formulaire →</Link></div>
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
