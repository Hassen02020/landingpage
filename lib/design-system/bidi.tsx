import type { ReactNode } from "react"

// Dans une phrase arabe (droite-gauche), un numéro écrit « 98 140 514 » s'affiche à l'envers (« 140 98 ») : les groupes de chiffres séparés par des espaces
// sont réordonnés. On isole donc chaque numéro dans un élément gauche-droite qui ne se coupe pas en fin de ligne.
const PHONE = /(\+?\d{2,3}(?: \d{3}){2}|\+?\d{2}(?: \d{2}){3}|\+\d{2,3}(?: \d{2,3}){2,4})/g

/** Texte avec les numéros de téléphone isolés (affichage correct en arabe, en français et en anglais). */
export function isolateNumbers(text: string): ReactNode {
  const parts = text.split(PHONE)
  if (parts.length === 1) return text
  return parts.map((p, i) => (i % 2 === 1 ? <bdi key={i} dir="ltr" className="whitespace-nowrap">{p}</bdi> : p))
}

/** Numéro isolé (en-tête, pieds de page, boutons). */
export function PhoneText({ children, className = "" }: { children: string; className?: string }) {
  return <bdi dir="ltr" className={`whitespace-nowrap ${className}`.trim()} style={{ unicodeBidi: "isolate" }}>{children}</bdi>
}
