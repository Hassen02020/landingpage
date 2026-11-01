"use client"

import { useFormState, useFormStatus } from "react-dom"
import { blockAction, countriesAction, type FormState } from "../../settings-actions"

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap">
      {pending ? "…" : children}
    </button>
  )
}

function Msg({ s }: { s?: FormState }) {
  if (!s?.message) return null
  return <p className={`text-sm ${s.ok ? "text-green-700" : "text-red-700"}`}>{s.message}</p>
}

export function BlockForm({ kind }: { kind: "phone" | "ip" }) {
  const [state, action] = useFormState(blockAction, undefined)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <input
          name="value"
          required
          placeholder={kind === "phone" ? "ex. 98 140 514 ou +33612345678" : "ex. 102.45.12.8"}
          className="flex-1 border rounded-xl px-3 py-2"
          dir="ltr"
          autoComplete="off"
        />
        <Submit>{kind === "phone" ? "Bloquer le numéro" : "Bloquer l'IP"}</Submit>
      </div>
      <input name="reason" placeholder="Raison (facultatif) : faux lead, spam…" className="w-full border rounded-xl px-3 py-2 text-sm" maxLength={200} />
      <Msg s={state} />
    </form>
  )
}

export function CountriesForm({ countries, allowed }: { countries: { code: string; name: string }[]; allowed: string[] }) {
  const [state, action] = useFormState(countriesAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name="all" defaultChecked={allowed.length === 0} /> Accepter tous les pays (recommandé : clients tunisiens à l&apos;étranger)
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {countries.map((c) => (
          <label key={c.code} className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
            <input type="checkbox" name="countries" value={c.code} defaultChecked={allowed.includes(c.code)} /> {c.name}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">Si « tous les pays » est décoché, seuls les pays cochés peuvent envoyer le formulaire (pays déduit de l&apos;adresse IP ; pays inconnu = accepté).</p>
      <div className="flex items-center justify-between gap-3">
        <Msg s={state} />
        <Submit>Enregistrer</Submit>
      </div>
    </form>
  )
}
