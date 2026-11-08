// Formulaire de collecte configurable par entreprise (chantier 05 B). Fonctions PURES : validation d'une configuration saisie par
// l'administrateur, et application de cette configuration à une demande envoyée par un visiteur.
// Règles intangibles (jamais configurables) : le nom, le numéro de téléphone et l'accord de recontact sont toujours exigés.

export const STANDARD_FIELDS = ["email", "message", "offer", "budget"] as const
export type StandardField = (typeof STANDARD_FIELDS)[number]
export const STANDARD_LABELS: Record<StandardField, string> = { email: "E-mail", message: "Message", offer: "Offre souhaitée", budget: "Budget" }
export const MAX_CUSTOM_FIELDS = 5

export interface FieldRule {
  enabled: boolean
  required: boolean
}
export interface CustomField {
  key: string // c1 … c5
  label: string
  required: boolean
}
export interface FormConfig {
  fields: Record<StandardField, FieldRule>
  custom: CustomField[]
  title: string
  intro: string
  thanks: string
}

export const defaultFormConfig = (): FormConfig => ({
  fields: {
    email: { enabled: true, required: false },
    message: { enabled: true, required: false },
    offer: { enabled: false, required: false },
    budget: { enabled: false, required: false },
  },
  custom: [],
  title: "",
  intro: "",
  thanks: "",
})

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "")
const KEY = /^c[1-5]$/

/** Lecture tolérante d'une configuration stockée : toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseFormConfig(raw: unknown): FormConfig {
  const base = defaultFormConfig()
  if (!raw || typeof raw !== "object") return base
  const r = raw as Record<string, unknown>
  const f = (r.fields && typeof r.fields === "object" ? r.fields : {}) as Record<string, unknown>
  for (const k of STANDARD_FIELDS) {
    const v = f[k] as Partial<FieldRule> | undefined
    if (v && typeof v === "object") base.fields[k] = { enabled: v.enabled === true, required: v.enabled === true && v.required === true }
  }
  if (Array.isArray(r.custom)) {
    const seen = new Set<string>()
    for (const c of r.custom.slice(0, MAX_CUSTOM_FIELDS)) {
      const o = (c ?? {}) as Record<string, unknown>
      const key = typeof o.key === "string" ? o.key : ""
      const label = clean(o.label, 60)
      if (KEY.test(key) && label && !seen.has(key)) {
        seen.add(key)
        base.custom.push({ key, label, required: o.required === true })
      }
    }
  }
  base.title = clean(r.title, 80)
  base.intro = clean(r.intro, 300)
  base.thanks = clean(r.thanks, 300)
  return base
}

/** Valide une configuration saisie dans l'administration. Renvoie la configuration nettoyée ou les erreurs par champ. */
export function validateFormConfigInput(input: {
  fields: Partial<Record<StandardField, { enabled?: boolean; required?: boolean }>>
  custom: { label?: string; required?: boolean }[]
  title?: string
  intro?: string
  thanks?: string
}): { config?: FormConfig; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const config = defaultFormConfig()
  for (const k of STANDARD_FIELDS) {
    const v = input.fields[k]
    const enabled = v?.enabled === true
    config.fields[k] = { enabled, required: enabled && v?.required === true }
  }
  const labels: CustomField[] = []
  input.custom.slice(0, MAX_CUSTOM_FIELDS).forEach((c, i) => {
    const label = clean(c.label, 60)
    if (!label) {
      if (c.required) errors[`custom_${i + 1}`] = "Donnez un intitulé au champ ou décochez « obligatoire »."
      return
    }
    if (label.length < 2) errors[`custom_${i + 1}`] = "Intitulé trop court (2 caractères minimum)."
    labels.push({ key: `c${i + 1}`, label, required: c.required === true })
  })
  config.custom = labels
  config.title = clean(input.title, 80)
  config.intro = clean(input.intro, 300)
  config.thanks = clean(input.thanks, 300)
  return Object.keys(errors).length ? { errors } : { config, errors }
}

export interface IntakeResult {
  errors: Record<string, string>
  custom: Record<string, string> | null // réponses aux champs personnalisés (clés c1…c5), null si aucune
  accepted: Partial<Record<StandardField, string>> // valeurs des champs standard ACTIVÉS (les autres sont ignorés)
}

/** Applique la configuration à la demande d'un visiteur : exigences, champs ignorés s'ils sont désactivés, réponses bornées. */
export function applyFormConfig(config: FormConfig, body: Record<string, unknown>): IntakeResult {
  const errors: Record<string, string> = {}
  const accepted: Partial<Record<StandardField, string>> = {}
  for (const k of STANDARD_FIELDS) {
    const rule = config.fields[k]
    if (!rule.enabled) continue
    const max = k === "message" ? 1000 : k === "offer" ? 255 : 200
    const v = clean(k === "message" ? String(body[k] ?? "").replace(/\r?\n/g, " ") : body[k], max)
    if (v) accepted[k] = v
    else if (rule.required) errors[k] = `${STANDARD_LABELS[k]} requis`
  }
  const rawCustom = (body.custom && typeof body.custom === "object" ? body.custom : {}) as Record<string, unknown>
  const custom: Record<string, string> = {}
  for (const c of config.custom) {
    const v = clean(rawCustom[c.key], 200)
    if (v) custom[c.key] = v
    else if (c.required) errors[c.key] = `${c.label} requis`
  }
  return { errors, accepted, custom: Object.keys(custom).length ? custom : null }
}
