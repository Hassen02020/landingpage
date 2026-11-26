"use client"

import { useState } from "react"
import { CONVERSATION_THEMES, NOTE_MAX } from "@/lib/conversation-themes"

/** Thème obligatoire + note courte (≤ 140 caractères, compteur). Le serveur refuse de toute façon un thème absent, une note trop longue, un numéro, un e-mail ou un lien. */
export default function ConversationFields({ idPrefix }: { idPrefix: string }) {
  const [theme, setTheme] = useState("")
  const [note, setNote] = useState("")
  const noteRequired = theme === "autre"
  return (
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex gap-2">
        <label htmlFor={`${idPrefix}-theme`} className="sr-only">Thème de la conversation</label>
        <select id={`${idPrefix}-theme`} name="theme" required value={theme} onChange={(e) => setTheme(e.target.value)} className="px-3 py-2 rounded-lg border bg-white">
          <option value="" disabled>Thème (obligatoire)</option>
          {CONVERSATION_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <label htmlFor={`${idPrefix}-note`} className="sr-only">Note courte</label>
        <input
          id={`${idPrefix}-note`}
          name="note"
          maxLength={NOTE_MAX}
          required={noteRequired}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={noteRequired ? "Note obligatoire pour « Autre »" : "Note courte (facultatif)"}
          autoComplete="off"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border"
        />
      </div>
      <p className="text-xs text-gray-600" aria-live="polite">{note.length} / {NOTE_MAX} caractères · ni numéro, ni e-mail, ni lien · ne collez pas le message du client</p>
    </div>
  )
}
