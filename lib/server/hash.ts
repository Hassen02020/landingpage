import { createHash, createHmac, randomBytes } from "crypto"

export function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export function randomRef(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  const bytes = randomBytes(6)
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] & 31]
  return `E2B-${out}`
}

/**
 * Normalise un numéro de téléphone en chiffres internationaux (sans "+").
 * Accepte les numéros tunisiens à 8 chiffres (mobile 2/4/5/9, fixe 3/7)
 * et les numéros internationaux saisis avec "+" ou "00" (diaspora).
 * Retourne null si le numéro est invalide.
 */
export function normalizePhone(input: string): string | null {
  const raw = String(input || "").replace(/[\s.\-()]/g, "")
  if (!raw) return null
  let digits: string
  if (raw.startsWith("+")) digits = raw.slice(1)
  else if (raw.startsWith("00")) digits = raw.slice(2)
  else digits = raw
  if (!/^\d+$/.test(digits)) return null

  if (/^[234579]\d{7}$/.test(digits)) return `216${digits}`
  if (/^216[234579]\d{7}$/.test(digits)) return digits
  // numéro étranger : doit avoir été saisi avec l'indicatif
  if ((raw.startsWith("+") || raw.startsWith("00")) && digits.length >= 9 && digits.length <= 15) return digits
  return null
}

export function clientIp(headers: Headers): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    undefined
  )
}
