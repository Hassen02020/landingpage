// Styles de la page publique par FAMILLE visuelle (classes Tailwind complètes : jamais construites dynamiquement) et ordre des sections.
import type { Family } from "./themes"

export type SectionKey = "intro" | "highlights" | "offers" | "inclusions" | "programme" | "gallery" | "faq" | "form"

export interface FamilyStyle {
  page: string
  heroNoImage: string
  accentText: string
  priceText: string
  button: string
  buttonSoft: string
  chip: string
  formBand: string
  sectionTitle: string
  ring: string
  accentColor: string
}

export const STYLE: Record<Family, FamilyStyle> = {
  omra: { page: "bg-stone-50", heroNoImage: "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950", accentText: "text-amber-300", priceText: "text-emerald-800", button: "bg-emerald-700 hover:bg-emerald-800", buttonSoft: "text-emerald-700", chip: "bg-emerald-100 text-emerald-800", formBand: "bg-emerald-50", sectionTitle: "text-emerald-900", ring: "ring-emerald-200", accentColor: "#15803d" },
  voyage: { page: "bg-slate-50", heroNoImage: "bg-gradient-to-br from-sky-900 via-blue-800 to-indigo-950", accentText: "text-amber-300", priceText: "text-blue-800", button: "bg-blue-700 hover:bg-blue-800", buttonSoft: "text-blue-700", chip: "bg-blue-100 text-blue-800", formBand: "bg-blue-50", sectionTitle: "text-blue-900", ring: "ring-blue-200", accentColor: "#1d4ed8" },
  hotel: { page: "bg-cyan-50/40", heroNoImage: "bg-gradient-to-br from-teal-800 via-cyan-800 to-teal-950", accentText: "text-amber-200", priceText: "text-teal-800", button: "bg-teal-700 hover:bg-teal-800", buttonSoft: "text-teal-700", chip: "bg-teal-100 text-teal-800", formBand: "bg-teal-50", sectionTitle: "text-teal-900", ring: "ring-teal-200", accentColor: "#0f766e" },
  autre: { page: "bg-violet-50/40", heroNoImage: "bg-gradient-to-br from-violet-900 via-fuchsia-800 to-violet-950", accentText: "text-amber-300", priceText: "text-violet-800", button: "bg-violet-700 hover:bg-violet-800", buttonSoft: "text-violet-700", chip: "bg-violet-100 text-violet-800", formBand: "bg-violet-50", sectionTitle: "text-violet-900", ring: "ring-violet-200", accentColor: "#6d28d9" },
}

/** Structure de page propre à chaque famille (les sections sans contenu ne s'affichent pas). */
export const SECTIONS: Record<Family, SectionKey[]> = {
  omra: ["intro", "offers", "inclusions", "programme", "faq", "form"],
  voyage: ["intro", "highlights", "offers", "programme", "gallery", "inclusions", "faq", "form"],
  hotel: ["intro", "offers", "inclusions", "gallery", "faq", "form"],
  autre: ["intro", "offers", "inclusions", "faq", "form"],
}

/** Contenu RÉEL tiré des offres (jamais inventé) : prestations dédoublonnées, programmes, images distinctes. */
export function derive(offers: { features: string[]; description: string | null; image_url: string | null; name: string }[]) {
  const seen: Record<string, true> = {}
  const features: string[] = []
  for (const o of offers) for (const f of o.features) {
    const k = f.trim().toLowerCase()
    if (k && !seen[k]) { seen[k] = true; features.push(f.trim()) }
  }
  const programmes = offers.filter((o) => Boolean((o.description || "").trim())).map((o) => ({ name: o.name, text: (o.description || "").trim() }))
  const imgSeen: Record<string, true> = {}
  const images: string[] = []
  for (const o of offers) if (o.image_url && !imgSeen[o.image_url]) { imgSeen[o.image_url] = true; images.push(o.image_url) }
  return { features: features.slice(0, 24), highlights: features.slice(0, 4), programmes, images }
}
