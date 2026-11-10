// Authentification des webhooks entrants (Meta, TikTok, WhatsApp). Aucune route ne les utilise encore :
// elles seront ajoutées avec les accès externes (application Meta, application TikTok, WhatsApp Business).
// Règle : on vérifie la signature sur le CORPS BRUT (octets reçus), avant tout traitement ni analyse JSON.
import { createHmac, timingSafeEqual } from "node:crypto"

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const hmacHex = (secret: string, payload: string) => createHmac("sha256", secret).update(payload, "utf8").digest("hex")

/**
 * Signature Meta (Facebook, Instagram, WhatsApp) : en-tête `X-Hub-Signature-256: sha256=<hex>`,
 * HMAC-SHA256 du corps brut avec le secret de l'application Meta.
 */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!appSecret || !header) return false
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim())
  if (!m) return false
  return safeEqual(m[1].toLowerCase(), hmacHex(appSecret, rawBody))
}

/**
 * Vérification d'abonnement Meta (GET) : `hub.mode=subscribe`, `hub.verify_token` identique au jeton choisi,
 * puis réponse = `hub.challenge` en texte brut. Renvoie null si la demande est refusée.
 */
export function metaChallenge(params: URLSearchParams, expectedToken: string): string | null {
  if (!expectedToken) return null
  if (params.get("hub.mode") !== "subscribe") return null
  const token = params.get("hub.verify_token")
  if (!token || !safeEqual(token, expectedToken)) return null
  const challenge = params.get("hub.challenge")
  return challenge && /^[\w.\-]{1,200}$/.test(challenge) ? challenge : null
}

/**
 * Signature horodatée générique (HMAC-SHA256 de `<horodatage>.<corps brut>`) avec tolérance anti-rejeu.
 * Prévue pour TikTok ; le schéma exact (en-tête, séparateur) est À CONFIRMER dans la documentation officielle
 * de TikTok au moment de la connexion : cette fonction ne doit pas être branchée avant cette confirmation.
 */
export function verifyTimestampedHmac(opts: {
  rawBody: string
  timestamp: string | null | undefined
  signature: string | null | undefined
  secret: string
  toleranceSeconds?: number
  nowSeconds?: number
}): boolean {
  const { rawBody, timestamp, signature, secret } = opts
  if (!secret || !timestamp || !signature) return false
  if (!/^\d{9,13}$/.test(timestamp)) return false
  const ts = Number(timestamp.length > 10 ? Math.floor(Number(timestamp) / 1000) : timestamp)
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > (opts.toleranceSeconds ?? 300)) return false
  if (!/^[0-9a-f]{64}$/i.test(signature.trim())) return false
  return safeEqual(signature.trim().toLowerCase(), hmacHex(secret, `${timestamp}.${rawBody}`))
}
