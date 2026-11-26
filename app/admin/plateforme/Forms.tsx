"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createOrganizationAction } from "./actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className="rounded-xl bg-brand-700 px-5 py-2.5 font-bold text-white hover:bg-brand-800 disabled:opacity-50">
      {pending ? "Création…" : "Créer l'entreprise et inviter son administrateur"}
    </button>
  )
}

export function CreateOrganization() {
  const [state, action] = useFormState(createOrganizationAction, undefined)
  const input = "w-full rounded-xl border border-gray-300 px-3 py-2"
  return (
    <form action={action} className="space-y-3">
      {state?.message && <div className={`rounded-xl border p-3 text-sm ${state.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{state.message}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        <input name="name" required aria-label="Nom de l'entreprise" placeholder="Nom de l'entreprise" className={input} />
        <input name="slug" aria-label="Identifiant (ex. bob-sarl, facultatif)" placeholder="Identifiant (ex. bob-sarl, facultatif)" className={input} dir="ltr" />
        <input name="sector" aria-label="Secteur (ex. voyage)" placeholder="Secteur (ex. voyage)" className={input} />
        <input name="admin_email" type="email" required aria-label="E-mail du premier administrateur" placeholder="E-mail du premier administrateur" className={input} dir="ltr" />
        <input name="admin_name" aria-label="Nom du premier administrateur" placeholder="Nom du premier administrateur" className={input} />
      </div>
      <Submit />
    </form>
  )
}
