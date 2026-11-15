// PERSONNALISATION D'UNE PAGE (couleurs, fond, bouton, ordre des sections, FAQ, témoignages, programme, présentation des prix).
// Modèle PUR et STRICT : tout ce qui vient d'un formulaire ou de la base passe par sanitizeDesign (couleurs hexadécimales vérifiées,
// longueurs et nombres bornés, texte brut uniquement). Aucun contenu n'est inventé : FAQ, témoignages et programme viennent de l'équipe.
import type { Family } from "./themes"
import type { SectionKey } from "./style"

export type BlockType = "text" | "benefits" | "steps" | "gallery" | "image_text" | "cta" | "notice" | "video"
export type DesignSection = SectionKey | "testimonials" | "services" | "conditions" | `block:${string}`

/** BIBLIOTHÈQUE DE BLOCS : 8 types génériques qui couvrent l'usage des 44 blocs du Landing Page Studio. Vidéo : fichier du site lui-même (dossier public), jamais une ressource tierce. */
export const BLOCK_TYPES: Record<BlockType, { label: string; hint: string }> = {
  text: { label: "Texte", hint: "Un titre et un paragraphe (présentation, hôtel, destination, informations pratiques…)." },
  benefits: { label: "Avantages", hint: "Une grille de points forts avec titre et texte court." },
  steps: { label: "Étapes", hint: "Une liste numérotée (programme jour par jour, démarches, étapes d'un visa…)." },
  gallery: { label: "Galerie d'images", hint: "Jusqu'à 8 images de la médiathèque." },
  image_text: { label: "Image et texte", hint: "Une image à côté d'un titre et d'un texte." },
  cta: { label: "Appel à l'action", hint: "Un message et un bouton vers le formulaire ou WhatsApp." },
  notice: { label: "Encadré", hint: "Un message mis en valeur (conditions, avantage, information importante)." },
  video: { label: "Vidéo", hint: "Une vidéo hébergée sur le site (fichier .mp4 ou .webm du dossier public), avec une image d'affiche. Aucun service tiers." },
}
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
export const SECTION_LABELS: Record<Exclude<DesignSection, `block:${string}`>, string> = {
  intro: "Texte de présentation", highlights: "Points forts", offers: "Départs et prix", inclusions: "Prestations incluses",
  programme: "Programme", gallery: "Galerie d'images", testimonials: "Témoignages", services: "Services inclus (cartes)", conditions: "Conditions et avantages", faq: "Questions fréquentes", form: "Formulaire de réservation",
}
export interface DesignBlock {
  id: string
  type: BlockType
  title: string
  text: string
  items: { title: string; text: string }[]
  images: string[]
  /** bouton d'un bloc « appel à l'action » : défile vers le formulaire ou ouvre WhatsApp */
  cta: "form" | "whatsapp"
  ctaLabel: string
  /** bloc « vidéo » : chemin d'un fichier du site (/….mp4 ou /….webm), jamais une adresse externe */
  video: string
}

export interface PageDesign {
  v: 1
  colors: { preset: string; custom: string }
  background: "famille" | "blanc" | "teinte"
  cta: { label: string; whatsapp: boolean }
  price: { prefix: boolean; showBefore: boolean }
  form: { email: boolean }
  /** mise en page de l'en-tête : « standard » (bandeau) ou « split » (texte + carte vidéo verticale, fond clair) */
  hero: "standard" | "split"
  sections: { key: DesignSection; visible: boolean }[]
  faq: { q: string; a: string }[]
  testimonials: { name: string; text: string; place: string }[]
  program: { title: string; text: string }[]
  /** cartes « ce qui est inclus » (ex. vol, visa, encadrement, hôtel) : texte fourni par l'équipe */
  services: { title: string; text: string }[]
  /** avantages et conditions (ex. réduction famille, groupes) : texte d'information, jamais un calcul */
  conditions: { title: string; text: string }[]
  /** date limite de l'offre (AAAA-MM-JJ, jour de Tunis) : affiche un compte à rebours tant qu'elle n'est pas passée ; vide = aucun */
  deadline: string
  /** blocs personnalisés (placés dans `sections` sous la clé « block:<id> ») */
  blocks: DesignBlock[]
}

export const SECTION_DEFAULTS: Record<Family, DesignSection[]> = {
  omra: ["intro", "services", "offers", "conditions", "inclusions", "programme", "testimonials", "faq", "form"],
  voyage: ["intro", "highlights", "offers", "programme", "gallery", "inclusions", "testimonials", "faq", "form"],
  hotel: ["intro", "offers", "inclusions", "gallery", "testimonials", "faq", "form"],
  autre: ["intro", "offers", "inclusions", "testimonials", "faq", "form"],
}

/** Libellé d'une section dans l'éditeur (les blocs portent le titre choisi par l'équipe). */
export const sectionLabel = (d: { blocks: { id: string; title: string }[] }, key: DesignSection): string =>
  key.startsWith("block:") ? `Bloc « ${d.blocks.find((b) => `block:${b.id}` === key)?.title ?? "?"} »` : SECTION_LABELS[key as Exclude<DesignSection, `block:${string}`>]

export const defaultDesign = (family: Family): PageDesign => ({
  v: 1, colors: { preset: "famille", custom: "" }, background: "famille", cta: { label: "", whatsapp: false }, price: { prefix: true, showBefore: true }, form: { email: false }, hero: "standard",
  sections: SECTION_DEFAULTS[family].map((key) => ({ key, visible: true })), faq: [], testimonials: [], program: [], services: [], conditions: [], deadline: "", blocks: [],
})

const HEX = /^#[0-9a-fA-F]{6}$/
/** Retire les « demi-caractères » (substituts UTF-16 isolés) : PostgreSQL les refuse dans un JSON (« invalid input syntax for type json »). */
function stripLoneSurrogates(t: string): string {
  let out = ""
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = t.charCodeAt(i + 1)
      if (n >= 0xdc00 && n <= 0xdfff) { out += t[i] + t[i + 1]; i++ }
    } else if (c < 0xdc00 || c > 0xdfff) out += t[i]
  }
  return out
}
// Texte brut : caractères de contrôle retirés (sauf tabulation et retours à la ligne), coupe SANS casser un caractère composé (emoji), puis aucun substitut isolé.
// eslint-disable-next-line no-control-regex
const clean = (v: unknown, max: number): string => (typeof v === "string" ? stripLoneSurrogates(stripLoneSurrogates(v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")).trim().slice(0, max)).trim() : "")

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

/**
 * Représentation TEXTE d'un JSONB telle que PostgreSQL la produit : `value::text` met une espace après chaque « : » et après chaque « , »
 * (plus long que JSON.stringify, qui est compact). L'ordre des clés n'a pas d'effet sur la taille. Les chaînes sont échappées comme JSON.stringify
 * (guillemet, antislash, \b \f \n \r \t, autres contrôles en \u00XX ; tout le reste, y compris les emojis, en UTF-8 brut).
 * La contrainte de la base mesure octet_length(design::text) : c'est CETTE mesure que le serveur applique (tests.design-jsonb-size : égalité exacte
 * avec PostgreSQL sur des centaines de cas).
 */
export function pgJsonText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(pgJsonText).join(", ")}]`
  if (v && typeof v === "object") return `{${Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${pgJsonText(x)}`).join(", ")}}`
  return JSON.stringify(v)
}

/** Taille acceptée SANS la migration 0022 : contrainte de 0018 (16 000 octets), 1 000 de marge. Au-delà, l'enregistrement exige 0022. */
export const LEGACY_DESIGN_BYTES = 15000
/** Taille maximale du design stocké, en OCTETS de sa forme PostgreSQL : contrainte de 0022 (64 000 octets), 4 000 de marge. */
export const MAX_DESIGN_BYTES = 60000
export const designBytes = (d: PageDesign): number => new TextEncoder().encode(pgJsonText(d)).length

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
  d.hero = r.hero === "split" ? "split" : "standard"

  const list = (v: unknown, max: number, label: string): unknown[] => {
    if (!Array.isArray(v)) return []
    if (v.length > max) errors[label] = `${max} éléments maximum.`
    return v.slice(0, max)
  }

  // blocs personnalisés : validés un par un (types connus, textes bornés, URL d'image https ou relatives seulement) ; les blocs incomplets sont signalés ET écartés
  const VIDEO = /^\/(?!\/)[A-Za-z0-9][A-Za-z0-9._\-\/]{0,190}\.(mp4|webm)$/ // fichier du site seulement : ni « // », ni http(s), ni « .. »
  const IMG = /^(https:\/\/|\/(?!\/))[^\s"'<>]{1,500}$/ // « // » refusé : une adresse relative au protocole chargerait une image d'un AUTRE site
  const seenIds: Record<string, true> = {}
  d.blocks = list(r.blocks, 12, "blocks").map(obj).flatMap((b, i): DesignBlock[] => {
    const type = clean(b.type, 20) as BlockType
    const id = clean(b.id, 12)
    const fail = (msg: string): DesignBlock[] => { errors[`block${i}`] = msg; return [] }
    if (!(type in BLOCK_TYPES)) return fail("Type de bloc inconnu.")
    if (!/^[a-z0-9]{4,12}$/.test(id)) return fail("Identifiant de bloc invalide.")
    if (seenIds[id]) return fail("Identifiant de bloc dupliqué.")
    const title = clean(b.title, 120), text = clean(b.text, 1200)
    if (!title) return fail("Le titre du bloc est requis.")
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map(obj).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 400) })).filter((x) => x.title)
    const images = (Array.isArray(b.images) ? b.images : []).slice(0, 8).map((x) => clean(x, 500)).filter(Boolean)
    if (images.some((u) => !IMG.test(u))) return fail("Image : adresse https:// ou chemin /… attendu.")
    if ((type === "benefits" || type === "steps") && items.length === 0) return fail("Ajoutez au moins un élément (titre requis).")
    if (type === "gallery" && images.length === 0) return fail("Ajoutez au moins une image.")
    if (type === "image_text" && (images.length < 1 || !text)) return fail("Une image et un texte sont requis.")
    if ((type === "text" || type === "notice") && !text) return fail("Le texte du bloc est requis.")
    const video = clean(b.video, 200)
    if (type === "video" && (!VIDEO.test(video) || video.includes(".."))) return fail("Vidéo : chemin d'un fichier du site attendu (ex. /ma-video.mp4).")
    if (type === "video" && images.length < 1) return fail("Ajoutez l'image d'affiche de la vidéo.")
    seenIds[id] = true
    return [{ id, type, title, text, items: type === "benefits" || type === "steps" ? items : [], images: type === "gallery" ? images : type === "image_text" || type === "video" ? images.slice(0, 1) : [], cta: b.cta === "whatsapp" ? "whatsapp" : "form", ctaLabel: type === "cta" ? clean(b.ctaLabel, 40) || "Réserver" : "" , video: type === "video" ? video : "" }]
  })

  // ordre des sections : permutation des sections autorisées pour la famille (+ les blocs) ; « form » toujours présent et visible
  const blockKeys = d.blocks.map((b) => `block:${b.id}` as DesignSection)
  const allowed: DesignSection[] = [...SECTION_DEFAULTS[family], ...blockKeys]
  const seen: Record<string, true> = {}
  const order: { key: DesignSection; visible: boolean }[] = []
  if (Array.isArray(r.sections)) for (const s of r.sections) {
    const o = obj(s); const key = o.key as DesignSection
    if (allowed.indexOf(key) >= 0 && !seen[key]) { seen[key] = true; order.push({ key, visible: key === "form" ? true : o.visible !== false }) }
  }
  for (const key of allowed) if (!seen[key]) {
    // un bloc nouveau se place avant la FAQ (sinon avant le formulaire) ; les autres sections manquantes vont à la fin, comme avant
    if (key.startsWith("block:")) {
      const at = order.findIndex((x) => x.key === "faq") >= 0 ? order.findIndex((x) => x.key === "faq") : order.findIndex((x) => x.key === "form")
      order.splice(at >= 0 ? at : order.length, 0, { key, visible: true })
    } else order.push({ key, visible: true })
  }
  d.sections = order

  d.faq = list(r.faq, 8, "faq").map(obj).map((x) => ({ q: clean(x.q, 140), a: clean(x.a, 600) })).filter((x) => x.q || x.a)
  d.faq.forEach((x, i) => { if (!x.q || !x.a) errors[`faq${i}`] = "Question et réponse sont toutes deux requises." })
  d.testimonials = list(r.testimonials, 6, "testimonials").map(obj).map((x) => ({ name: clean(x.name, 60), text: clean(x.text, 400), place: clean(x.place, 60) })).filter((x) => x.name || x.text)
  d.testimonials.forEach((x, i) => { if (!x.name || !x.text) errors[`testimonial${i}`] = "Nom et texte du témoignage sont requis." })
  d.program = list(r.program, 14, "program").map(obj).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 800) })).filter((x) => x.title || x.text)
  d.program.forEach((x, i) => { if (!x.title || !x.text) errors[`program${i}`] = "Titre et texte de l'étape sont requis." })

  d.services = list(r.services, 6, "services").map(obj).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 400) })).filter((x) => x.title || x.text)
  d.services.forEach((x, i) => { if (!x.title || !x.text) errors[`services${i}`] = "Titre et texte de la carte sont requis." })
  d.conditions = list(r.conditions, 8, "conditions").map(obj).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 300) })).filter((x) => x.title || x.text)
  d.conditions.forEach((x, i) => { if (!x.title || !x.text) errors[`conditions${i}`] = "Titre et texte de la condition sont requis." })
  const deadline = clean(r.deadline, 10)
  if (deadline) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(`${deadline}T12:00:00Z`)) || new Date(`${deadline}T12:00:00Z`).toISOString().slice(0, 10) !== deadline) errors.deadline = "Date limite : jour valide attendu (AAAA-MM-JJ)."
    else d.deadline = deadline
  }

  // éléments incomplets écartés du design retourné : jamais publiés à moitié
  d.faq = d.faq.filter((x) => x.q && x.a)
  d.testimonials = d.testimonials.filter((x) => x.name && x.text)
  d.program = d.program.filter((x) => x.title && x.text)
  d.services = d.services.filter((x) => x.title && x.text)
  d.conditions = d.conditions.filter((x) => x.title && x.text)
  if (designBytes(d) > MAX_DESIGN_BYTES) errors.size = `Personnalisation trop volumineuse (${designBytes(d)} octets, ${MAX_DESIGN_BYTES} maximum) : raccourcissez les blocs, le programme, la FAQ ou les témoignages.`
  return { design: d, errors }
}

/** Sections à afficher, dans l'ordre choisi ; « témoignages » n'apparaît que s'il y en a. */
export function visibleSections(d: PageDesign): DesignSection[] {
  return d.sections
    .filter((s) => s.visible && (s.key !== "testimonials" || d.testimonials.length > 0) && (s.key !== "services" || d.services.length > 0) && (s.key !== "conditions" || d.conditions.length > 0))
    .map((s) => s.key)
}
