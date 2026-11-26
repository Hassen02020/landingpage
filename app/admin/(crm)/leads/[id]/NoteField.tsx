"use client"

import { useState } from "react"

/** Champ de mention courte avec compteur de caractères (140 au plus) ; le serveur revalide tout. */
export default function NoteField({ name, defaultValue, label, disabled }: { name: string; defaultValue?: string | null; label: string; disabled?: boolean }) {
  const [v, setV] = useState(defaultValue ?? "")
  return (
    <label className="block">
      <span className="text-gray-600">{label}</span>
      <input name={name} value={v} onChange={(e) => setV(e.target.value)} maxLength={140} disabled={disabled} aria-describedby={`${name}-count`} className="mt-1 w-full px-3 py-2 rounded-lg border disabled:bg-gray-50" />
      <span id={`${name}-count`} className="text-xs text-gray-500" aria-live="polite">{v.length}/140 · ni numéro, ni e-mail, ni lien, aucun document</span>
    </label>
  )
}
