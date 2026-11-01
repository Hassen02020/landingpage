"use client"

import { useFormState, useFormStatus } from "react-dom"
import { loginAction } from "../actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 rounded-xl disabled:opacity-50">
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(loginAction, undefined)
  return (
    <form action={action} className="space-y-3">
      {state?.error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" required autoComplete="username" placeholder="E-mail" className="w-full px-4 py-3 rounded-xl border border-gray-300" />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Mot de passe" className="w-full px-4 py-3 rounded-xl border border-gray-300" />
      <Submit />
    </form>
  )
}
