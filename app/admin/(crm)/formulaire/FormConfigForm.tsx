"use client"

import { useFormState, useFormStatus } from "react-dom"
import { MAX_CUSTOM_FIELDS, STANDARD_FIELDS, STANDARD_LABELS, type FormConfig } from "@/lib/form-config"
import { saveFormConfigAction } from "../../formulaire-actions"

function Save() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="rounded-xl bg-violet-700 px-5 py-2.5 font-bold text-white hover:bg-violet-800 disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer le formulaire"}</button>
}

export function FormConfigForm({ config }: { config: FormConfig }) {
  const [state, action] = useFormState(saveFormConfigAction, undefined)
  const input = "w-full rounded-xl border border-gray-300 px-3 py-2"
  return (
    <form action={action} className="space-y-6">
      {state?.message && <div className={`rounded-xl border p-3 text-sm ${state.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{state.message}</div>}
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-black">Champs standard</h2>
        <div className="divide-y text-sm">
          {STANDARD_FIELDS.map((k) => (
            <div key={k} className="flex flex-wrap items-center gap-4 py-2">
              <span className="w-40 font-semibold">{STANDARD_LABELS[k]}</span>
              <label className="flex items-center gap-1"><input type="checkbox" name={`f_${k}_enabled`} defaultChecked={config.fields[k].enabled} /> Afficher</label>
              <label className="flex items-center gap-1"><input type="checkbox" name={`f_${k}_required`} defaultChecked={config.fields[k].required} /> Obligatoire</label>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-black">Champs personnalisés (jusqu&apos;à {MAX_CUSTOM_FIELDS})</h2>
        {Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => {
          const c = config.custom[i]
          return (
            <div key={i} className="flex flex-wrap items-center gap-3">
              <input name={`custom_${i + 1}_label`} defaultValue={c?.label ?? ""} placeholder={`Champ ${i + 1} : intitulé (ex. Ville)`} className={`${input} max-w-xs`} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name={`custom_${i + 1}_required`} defaultChecked={c?.required ?? false} /> Obligatoire</label>
              {state?.errors?.[`custom_${i + 1}`] && <span className="text-sm text-red-700">{state.errors[`custom_${i + 1}`]}</span>}
            </div>
          )
        })}
      </section>
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-black">Textes</h2>
        <input name="title" defaultValue={config.title} placeholder="Titre de la page (par défaut : le nom de l'entreprise)" className={input} />
        <textarea name="intro" defaultValue={config.intro} rows={2} placeholder="Texte d'introduction (facultatif)" className={input} />
        <textarea name="thanks" defaultValue={config.thanks} rows={2} placeholder="Message affiché après l'envoi (facultatif)" className={input} />
      </section>
      <Save />
    </form>
  )
}
