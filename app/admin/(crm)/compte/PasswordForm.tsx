"use client"

import { useFormState, useFormStatus } from "react-dom"
import { changePasswordAction } from "../../team-actions"

function Save() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="bg-violet-700 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50">{pending ? "…" : "Changer le mot de passe"}</button>
}

export function PasswordForm() {
  const [state, action] = useFormState(changePasswordAction, undefined)
  return (
    <form action={action} className="space-y-3 max-w-sm">
      <input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="Nouveau mot de passe (10 caractères min.)" className="w-full border rounded-xl px-3 py-2" />
      <input name="confirm" type="password" required minLength={10} autoComplete="new-password" placeholder="Confirmer" className="w-full border rounded-xl px-3 py-2" />
      {state?.message && <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
      <Save />
    </form>
  )
}
