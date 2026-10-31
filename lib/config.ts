// Configuration partagée Easy2Book (client + serveur).
// Les identifiants publics (pixels) peuvent être surchargés par variables d'environnement.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://landingpage-easy2book.vercel.app"

export const WHATSAPP_NUMBER = "21698140514" // format international, sans "+"
export const PHONE_NUMBER = "98140514"

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1674012850599992"
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || ""

// Produits proposés sur les landing pages — utilisés pour segmenter les leads dans le CRM.
export const PRODUCTS = {
  omra: "Omra",
  voyage: "Voyage organisé",
  hotel: "Promo hôtel",
  autre: "Autre demande",
} as const

export type Product = keyof typeof PRODUCTS

export function isProduct(value: unknown): value is Product {
  return typeof value === "string" && value in PRODUCTS
}

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/Easy2Bookplateforme",
  instagram: "https://www.instagram.com/easy2book.2025/",
  tiktok: "https://www.tiktok.com/@easy2book",
} as const
