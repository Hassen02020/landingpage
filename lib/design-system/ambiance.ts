// Ambiances par produit du système de composants Easy2Book.
// Règle d'identité : la marque (bleu, jaune, logo, police) ne change JAMAIS d'un produit à l'autre ; seule la surface d'ambiance varie.
// Tant qu'une ambiance n'a pas été validée par le propriétaire avec ses photographies, elle reprend le bleu clair de marque (statut « à valider »).
export type ProductKind = "omra" | "hotel" | "flight" | "boat" | "transfer" | "attraction" | "package" | "organized_trip"

export interface Ambiance {
  label: string
  /** classes Tailwind de la surface (hero, cartes de services) : uniquement des couleurs de marque */
  surface: string
  line: string
  /** « valide » = ambiance approuvée par le propriétaire ; « a-valider » = reprend le bleu clair de marque */
  status: "valide" | "a-valider"
}

const NEUTRAL: Omit<Ambiance, "label"> = { surface: "bg-e2b-blue-soft", line: "border-e2b-blue-soft", status: "a-valider" }

export const AMBIANCES: Record<ProductKind, Ambiance> = {
  omra: { label: "Omra", surface: "bg-e2b-surface-omra", line: "border-e2b-line-omra", status: "valide" },
  hotel: { label: "Hôtels", ...NEUTRAL },
  flight: { label: "Vols", ...NEUTRAL },
  boat: { label: "Bateaux", ...NEUTRAL },
  transfer: { label: "Transferts", ...NEUTRAL },
  attraction: { label: "Attractions", ...NEUTRAL },
  package: { label: "Packages", ...NEUTRAL },
  organized_trip: { label: "Voyages organisés", ...NEUTRAL },
}

/** Correspondance avec les familles de produits du Créateur (omra, voyage, hôtel, autre). */
export const ambianceForFamily = (family: string): Ambiance =>
  family === "omra" ? AMBIANCES.omra : family === "hotel" ? AMBIANCES.hotel : family === "voyage" ? AMBIANCES.organized_trip : { label: "Autre", ...NEUTRAL }
