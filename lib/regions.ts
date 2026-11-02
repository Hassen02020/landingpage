// Gouvernorats de Tunisie (+ « Étranger »), valeurs identiques à la contrainte SQL de la migration 0006.
export const REGIONS = ["Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte", "Béja", "Jendouba", "Le Kef", "Siliana", "Sousse", "Monastir", "Mahdia", "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid", "Gabès", "Médenine", "Tataouine", "Gafsa", "Tozeur", "Kébili", "Étranger"] as const
export type Region = (typeof REGIONS)[number]
export const isRegion = (v: unknown): v is Region => typeof v === "string" && (REGIONS as readonly string[]).includes(v)

export const CONTACT_CHANNELS = ["whatsapp", "phone", "email"] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = { whatsapp: "WhatsApp", phone: "Appel téléphonique", email: "E-mail" }
