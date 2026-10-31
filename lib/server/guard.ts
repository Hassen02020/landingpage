// Protections communes des API publiques : origine, débit, doublons.
// NB : ces compteurs sont en mémoire, donc par instance serverless. Ils filtrent
// les doubles clics et les abus simples, pas une attaque distribuée (voir README).

import { sha256 } from "./hash"

/** Refuse les requêtes navigateur venant d'un autre site (en-tête Origin). */
export function isAllowedOrigin(headers: Headers): boolean {
  const origin = headers.get("origin")
  if (!origin) return true // appels sans navigateur : pas d'Origin (non bloquable par ce moyen)
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const allowed = new Set<string>()
  const host = headers.get("x-forwarded-host") || headers.get("host")
  if (host) allowed.add(host)
  for (const value of [process.env.NEXT_PUBLIC_SITE_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")]) {
    if (!value?.trim()) continue
    try {
      allowed.add(new URL(value.trim()).host)
    } catch {
      /* valeur invalide ignorée */
    }
  }
  return allowed.has(originHost)
}

const windows = new Map<string, number[]>()

/** Fenêtre glissante : `max` requêtes par `windowMs` et par clé. */
export function rateLimited(key: string | undefined, max: number, windowMs: number): boolean {
  if (!key) return false
  const now = Date.now()
  const recent = (windows.get(key) || []).filter((t) => now - t < windowMs)
  recent.push(now)
  windows.set(key, recent)
  if (windows.size > 10000) windows.clear()
  return recent.length > max
}

const seen = new Map<string, { at: number; value: string }>()

/**
 * Anti-doublon : renvoie la valeur mémorisée si `parts` a déjà été vu dans la fenêtre,
 * sinon mémorise `value` et renvoie null. Les clés sont hachées (pas de téléphone en clair).
 */
export function rememberOnce(parts: string[], value: string, windowMs: number): string | null {
  const key = sha256(parts.join("|"))
  const now = Date.now()
  const hit = seen.get(key)
  if (hit && now - hit.at < windowMs) return hit.value
  seen.set(key, { at: now, value })
  if (seen.size > 10000) {
    for (const [k, v] of Array.from(seen.entries())) if (now - v.at >= windowMs) seen.delete(k)
  }
  return null
}

/** Réservé aux tests. */
export function __resetGuards(): void {
  windows.clear()
  seen.clear()
}
