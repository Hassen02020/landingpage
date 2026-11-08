"use client"

import { useEffect, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { acceptInvitationAction } from "./actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-xl bg-violet-700 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50">
      {pending ? "Enregistrement…" : "Choisir mon mot de passe"}
    </button>
  )
}

export function InvitationForm() {
  const [state, action] = useFormState(acceptInvitationAction, undefined)
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    // Supabase place le jeton dans le fragment d'URL (#access_token=…) : il ne transite jamais par nos journaux
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    setToken(hash.get("access_token") ?? "")
    if (window.location.hash) history.replaceState(null, "", window.location.pathname)
  }, [])
  if (token === null) return <p className="text-sm text-gray-500">Chargement…</p>
  if (!token) return <p className="text-sm text-red-700">Lien d&apos;invitation invalide ou expiré. Demandez une nouvelle invitation à la plateforme.</p>
  return (
    <form action={action} className="space-y-3">
      {state?.error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <input type="hidden" name="token" value={token} />
      <input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="Mot de passe (10 caractères minimum)" className="w-full rounded-xl border border-gray-300 px-4 py-3" />
      <input name="again" type="password" required minLength={10} autoComplete="new-password" placeholder="Répéter le mot de passe" className="w-full rounded-xl border border-gray-300 px-4 py-3" />
      <Submit />
    </form>
  )
}
