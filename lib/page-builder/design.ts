// PERSONNALISATION D'UNE PAGE (couleurs, fond, bouton, ordre des sections, FAQ, témoignages, programme, présentation des prix).
// Modèle PUR et STRICT : tout ce qui vient d'un formulaire ou de la base passe par sanitizeDesign (couleurs hexadécimales vérifiées,
// longueurs et nombres bornés, texte brut uniquement). Aucun contenu n'est inventé : FAQ, témoignages et programme viennent de l'équipe.
import type { Family } from "./themes"
import type { SectionKey } from "./style"

export type DesignSection = SectionKey | "testimonials"
export const PRESETS: Record<string, { label: string; hex: string | null }> = {
  famille: { label: "Couleur du modèle", hex: null },
  emeraude: { label: "Émeraude", hex: "#047857" },
  bleu: { label: "Bleu", hex: "#1d4ed8" },
  turquoise: { label: "Turquoise", hex: "#0f766e" },
  violet: { label: "Violet", hex: "#6d28d9" },
  rouge: { label: "Rouge", hex: "#b91c1c" },
  orange: { label: "Orange", hex: "#c2410c" },
  noir: { label: "Anthracite", hex: "#1f2937" },
}
export const SECTION_LABELS: Record<DesignSection, string> = {
  intro: "Texte de présentation", highlights: "Points forts", offers: "Départs et prix", inclusions: "Prestations incluses",
  programme: "Programme", gallery: "Galerie d'images", testimonials: "Témoignages", faq: "Questions fréquentes", form: "Formulaire de réservation",
}
export interface PageDesign {
  v: 1
  colors: { preset: string; custom: string }
  background: "famille" | "blanc" | "teinte"
  cta: { label: string; whatsapp: boolean }
  price: { prefix: boolean; showBefore: boolean }
  form: { email: boolean }
  sections: { key: DesignSection; visible: boolean }[]
  faq: { q: string; a: string }[]
  testimonials: { name: string; text: string; place: string }[]
  program: { title: string; text: string }[]
}

export const SECTION_DEFAULTS: Record<Family, DesignSection[]> = {
  omra: ["intro", "offers", "inclusions", "programme", "testimonials", "faq", "form"],
  voyage: ["intro", "highlights", "offers", "programme", "gallery", "inclusions", "testimonials", "faq", "form"],
  hotel: ["intro", "offers", "inclusions", "gallery", "testimonials", "faq", "form"],
  autre: ["intro", "offers", "inclusions", "testimonials", "faq", "form"],
}

export const defaultDesign = (family: Family): PageDesign => ({
  v: 1, colors: { preset: "famille", custom: "" }, background: "famille", cta: { label: "", whatsapp: false }, price: { prefix: true, showBefore: true }, form: { email: false },
  sections: SECTION_DEFAULTS[family].map((key) => ({ key, visible: true })), faq: [], testimonials: [], program: [],
})

const HEX = /^#[0-9a-fA-F]{6}$/
// eslint-disable-next-line no-control-regex
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "")

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
/** Contraste d'un texte BLANC sur cette couleur (boutons, bandeaux). 4.5 = norme AA du texte courant. */
export const contrastWithWhite = (hex: string): number => 1.05 / (luminance(hex) + 0.05)
export const MIN_CONTRAST = 4.5

export const resolvePrimary = (d: PageDesign): string | null => {
  if (d.colors.custom && HEX.test(d.colors.custom) && contrastWithWhite(d.colors.custom) >= MIN_CONTRAST) return d.colors.custom.toLowerCase()
  const p = PRESETS[d.colors.preset]?.hex ?? null
  return p
}
/** Teinte très claire (mélange avec du blanc) pour les fonds et pastilles. */
export function tint(hex: string, ratio = 0.9): string {
  const mix = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - ratio) + 255 * ratio).toString(16).padStart(2, "0")
  return `#${mix(1)}${mix(3)}${mix(5)}`
}

export type DesignErrors = Record<string, string>

/** Taille maximale du design sérialisé, en OCTETS (la base refuse au-delà de 16 000 : marge de sécurité). */
export const MAX_DESIGN_BYTES = 15000
export const designBytes = (d: PageDesign): number => new TextEncoder().encode(JSON.stringify(d)).length

/** Nettoie ET valide : renvoie le design sûr et la liste des problèmes (les champs invalides sont écartés, jamais corrigés en silence). */
export function sanitizeDesign(raw: unknown, family: Family): { design: PageDesign; errors: DesignErrors } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const d = defaultDesign(family)
  const errors: DesignErrors = {}
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

  const colors = obj(r.colors)
  const preset = clean(colors.preset, 20)
  if (preset in PRESETS) d.colors.preset = preset
  else if (preset) errors.colors = "Couleur inconnue."
  const custom = clean(colors.custom, 7)
  if (custom) {
    if (!HEX.test(custom)) errors.custom = "Couleur : code hexadécimal attendu (ex. #1d4ed8)."
    else if (contrastWithWhite(custom) < MIN_CONTRAST) errors.custom = "Cette couleur est trop claire : le texte blanc des boutons serait illisible. Choisissez une couleur plus foncée."
    else d.colors.custom = custom.toLowerCase()
  }
  d.background = r.background === "blanc" || r.background === "teinte" ? r.background : "famille"

  const cta = obj(r.cta)
  d.cta = { label: clean(cta.label, 40), whatsapp: cta.whatsapp === true }
  const price = obj(r.price)
  d.price = { prefix: price.prefix !== false, showBefore: price.showBefore !== false }

  d.form = { email: obj(r.form).email === true }

  // ordre des sections : permutation des sections autorisées pour la famille ; « form » toujours présent et visible
  const allowed = SECTION_DEFAULTS[family]
  const seen: Record<string, true> = {}
  const order: { key: DesignSection; visible: boolean }[] = []
  if (Array.isArray(r.sections)) for (const s of r.sections) {
    const o = obj(s); const key = o.key as DesignSection
    if (allowed.indexOf(key) >= 0 && !seen[key]) { seen[key] = true; order.push({ key, visible: key === "form" ? true : o.visible !== false }) }
  }
  for (const key of allowed) if (!seen[key]) order.push({ key, visible: true })
  d.sections = order

  const list = (v: unknown, max: number, label: string): unknown[] => {
    if (!Array.isArray(v)) return []
    if (v.length > max) errors[label] = `${max} éléments maximum.`
    return v.slice(0, max)
  }
  d.faq = list(r.faq, 8, "faq").map(obj).map((x) => ({ q: clean(x.q, 140), a: clean(x.a, 600) })).filter((x) => x.q || x.a)
  d.faq.forEach((x, i) => { if (!x.q || !x.a) errors[`faq${i}`] = "Question et réponse sont toutes deux requises." })
  d.testimonials = list(r.testimonials, 6, "testimonials").map(obj).map((x) => ({ name: clean(x.name, 60), text: clean(x.text, 400), place: clean(x.place, 60) })).filter((x) => x.name || x.text)
  d.testimonials.forEach((x, i) => { if (!x.name || !x.text) errors[`testimonial${i}`] = "Nom et texte du témoignage sont requis." })
  d.program = list(r.program, 14, "program").map(obj).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 800) })).filter((x) => x.title || x.text)
  d.program.forEach((x, i) => { if (!x.title || !x.text) errors[`program${i}`] = "Titre et texte de l'étape sont requis." })

  // éléments incomplets écartés du design retourné : jamais publiés à moitié
  d.faq = d.faq.filter((x) => x.q && x.a)
  d.testimonials = d.testimonials.filter((x) => x.name && x.text)
  d.program = d.program.filter((x) => x.title && x.text)
  if (designBytes(d) > MAX_DESIGN_BYTES) errors.size = `Personnalisation trop volumineuse (${designBytes(d)} octets, ${MAX_DESIGN_BYTES} maximum) : raccourcissez le programme, la FAQ ou les témoignages.`
  return { design: d, errors }
}

/** Sections à afficher, dans l'ordre choisi ; « témoignages » n'apparaît que s'il y en a. */
export function visibleSections(d: PageDesign): DesignSection[] {
  return d.sections.filter((s) => s.visible && (s.key !== "testimonials" || d.testimonials.length > 0)).map((s) => s.key)
}
