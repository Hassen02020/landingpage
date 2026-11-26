// Thèmes de conversation et note courte (lot L2, option A du 25/11/2026).
// Un échange commercial est enregistré sous la forme « [Thème] note courte » : jamais le texte brut d'un message.
// Ce module est pur (aucun accès base) : il sert au serveur (contrôle) et à l'interface (liste des thèmes).

export const NOTE_MAX = 140

export const CONVERSATION_THEMES = [
  { id: "prix", label: "Prix demandé" },
  { id: "dates", label: "Dates" },
  { id: "disponibilites", label: "Disponibilités" },
  { id: "devis", label: "Devis demandé" },
  { id: "rappel", label: "Rappel demandé" },
  { id: "hesitation", label: "Hésitation" },
  { id: "annulation", label: "Annulation" },
  { id: "autre", label: "Autre" },
] as const

export type ConversationThemeId = (typeof CONVERSATION_THEMES)[number]["id"]

export const themeLabel = (id: string): string | null => CONVERSATION_THEMES.find((t) => t.id === id)?.label ?? null

// numéro de téléphone : au moins 8 chiffres, séparés ou non par espaces, points, tirets ou parenthèses
const PHONE = /(?:\+?\d[\s.\-()]*){8,}/
const EMAIL = /[^\s@]+@[^\s@]+/
// lien : schéma, « www. », ou nom de domaine suivi d'une extension courante
const LINK = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|info|tn|fr|me|io|app|link|ly|co|be|de|es|it|ma|dz)\b)/i

/** Contrôle d'une note courte. Renvoie le texte nettoyé, ou une erreur en français. `required` = note obligatoire (thème « Autre »). */
export function checkNote(raw: string, required: boolean): { ok: true; note: string } | { ok: false; error: string } {
  const note = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!note) return required ? { ok: false, error: "Pour le thème « Autre », une note est obligatoire." } : { ok: true, note: "" }
  if (note.length > NOTE_MAX) return { ok: false, error: `Note trop longue : ${NOTE_MAX} caractères maximum (ne collez pas le message).` }
  if (EMAIL.test(note)) return { ok: false, error: "Note refusée : elle ne doit contenir aucune adresse e-mail." }
  if (LINK.test(note)) return { ok: false, error: "Note refusée : elle ne doit contenir aucun lien." }
  if (PHONE.test(note)) return { ok: false, error: "Note refusée : elle ne doit contenir aucun numéro de téléphone." }
  return { ok: true, note }
}

export type ConversationEntry = { ok: true; body: string } | { ok: false; error: string }

/** Thème obligatoire + note contrôlée → texte enregistré dans l'activité : « [Thème] note » (préfixe facultatif, ex. « Appel »). */
export function buildConversationBody(themeId: string, rawNote: string, prefix?: string): ConversationEntry {
  const label = themeLabel(themeId)
  if (!label) return { ok: false, error: "Choisissez un thème de conversation." }
  const n = checkNote(rawNote, themeId === "autre")
  if (!n.ok) return n
  const head = prefix ? `[${prefix} · ${label}]` : `[${label}]`
  return { ok: true, body: n.note ? `${head} ${n.note}` : head }
}
