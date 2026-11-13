// Adresse publique d'une page du Créateur : /p/<adresse> (rendu par famille). La catégorie « omra-2027 » reste servie par /omra (une seule adresse officielle).
// Les pages /c/<adresse> existantes gardent leur rendu historique et ne sont pas modifiées.
export const RESERVED_ALIAS: Record<string, string> = { "omra-2027": "/omra" }
export const creatorPath = (slug: string): string => RESERVED_ALIAS[slug] ?? `/p/${slug}`
