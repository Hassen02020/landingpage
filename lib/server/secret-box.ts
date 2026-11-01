// Chiffrement des jetons d'intégration avant stockage en base (AES-256-GCM, authentifié).
// Clé dérivée (HKDF-SHA256) de LANDING_SECRETS_KEY si elle existe, sinon de la clé serveur
// Supabase (LANDING_SUPABASE_SERVICE_ROLE_KEY), déjà présente côté serveur uniquement.
// Conséquence : une fuite de la base seule ne révèle aucun jeton. Si la clé source change
// (rotation de la clé Supabase), les jetons enregistrés deviennent illisibles et doivent être
// ressaisis dans /admin/integrations (l'écran le signale).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

const VERSION = "v1"
const INFO = "easy2book-landing-integrations-v1"

export class SecretBoxError extends Error {}

function keyMaterial(): string {
  const source = process.env.LANDING_SECRETS_KEY || process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY
  if (!source || source.length < 20) throw new SecretBoxError("clé de chiffrement indisponible")
  return source
}

function deriveKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", keyMaterial(), Buffer.alloc(0), INFO, 32))
}

export function secretBoxAvailable(): boolean {
  try {
    keyMaterial()
    return true
  } catch {
    return false
  }
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv)
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":")
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(":")
  if (version !== VERSION || !iv || !tag || !data) throw new SecretBoxError("format de jeton chiffré inconnu")
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new SecretBoxError("jeton illisible (clé de chiffrement changée ?) : à ressaisir")
  }
}
