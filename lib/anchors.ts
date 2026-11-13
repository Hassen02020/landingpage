// Ancres par produit : /voyages-organises#voyage-<id> et /summer-vibes#hotel-<slug> mènent directement à la carte, sans nouvelle page.
// Identifiants STABLES (dérivés de l'identifiant du voyage / du nom de l'hôtel), sans espace ni caractère spécial.
export const slugify = (s: string): string =>
  String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export const voyageAnchor = (id: string): string => `voyage-${slugify(id)}`
export const hotelAnchor = (name: string): string => `hotel-${slugify(name)}`
