"use client"

import { useFormState, useFormStatus } from "react-dom"
import { addMemberAction, resetPasswordAction, type TeamState } from "../../team-actions"

function Btn({ children, ghost = false }: { children: React.ReactNode; ghost?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={ghost ? "text-xs border rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-50" : "bg-violet-700 hover:bg-violet-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50"}>
      {pending ? "…" : children}
    </button>
  )
}

function Result({ s }: { s?: TeamState }) {
  if (!s?.message) return null
  return (
    <div className={`text-sm rounded-xl p-3 ${s.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
      {s.message}
      {s.password && <code className="block mt-2 text-base font-bold tracking-wider select-all bg-white border rounded-lg p-2" dir="ltr">{s.password}</code>}
    </div>
  )
}

export function AddMember() {
  const [state, action] = useFormState(addMemberAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input name="email" type="email" required placeholder="E-mail" className="border rounded-xl px-3 py-2 sm:col-span-2" dir="ltr" />
        <input name="full_name" placeholder="Nom complet" className="border rounded-xl px-3 py-2" />
        <select name="role" defaultValue="agent" className="border rounded-xl px-3 py-2">
          <option value="agent">Agent (leads)</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <div className="flex justify-end"><Btn>Ajouter le membre</Btn></div>
      <Result s={state} />
    </form>
  )
}

export function ResetPassword({ userId }: { userId: string }) {
  const [state, action] = useFormState(resetPasswordAction, undefined)
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="user_id" value={userId} />
      <Btn ghost>Nouveau mot de passe</Btn>
      <Result s={state} />
    </form>
  )
}
