// PROTECTION DE L'ADRESSE PUBLIQUE d'une catégorie (fonction PURE). Une adresse déjà publiée ou utilisée ne change pas silencieusement :
// des publicités, des QR codes ou des liens partagés peuvent y mener. Le CONTENU (nom, textes, images, offres, visibilité) reste modifiable.
export const RESERVED_SLUGS = ["omra-2027"] // servie par /omra (une seule adresse officielle par contenu)

export type SlugLock = { locked: false } | { locked: true; reason: "visible" | "reserved" | "utilisee" | "verification"; message: string }

export function slugLock(input: { slug: string; visible: boolean; referenced: boolean | "inconnu" }): SlugLock {
  if (RESERVED_SLUGS.includes(input.slug)) return { locked: true, reason: "reserved", message: "Cette adresse est réservée (elle est servie par une page fixe du site)." }
  if (input.visible) return { locked: true, reason: "visible", message: "Adresse verrouillée : la page est publiée, des liens publicitaires peuvent y mener. Masquez-la d'abord si vous devez vraiment la changer — ou créez une nouvelle page." }
  if (input.referenced === "inconnu") return { locked: true, reason: "verification", message: "Adresse verrouillée par prudence : impossible de vérifier si elle a déjà été utilisée." }
  if (input.referenced) return { locked: true, reason: "utilisee", message: "Adresse verrouillée : des visiteurs ou des prospects sont déjà passés par cette adresse." }
  return { locked: false }
}

/** « Omra Ramadan 2027 ! » → « omra-ramadan-2027 » (60 caractères max) — partagé par le catalogue (serveur) et le Créateur (aperçu côté navigateur). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}
