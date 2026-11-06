// Détection du canal d'acquisition (pure, testable : aucune dépendance au navigateur).
// Règles : jamais de « fragment de lettres » (« ig » ne doit pas reconnaître « digital »).
// Un paramètre utm_source n'est reconnu que s'il contient un MOT ENTIER connu.

export type Channel = "meta" | "tiktok" | "whatsapp" | "google" | "organic" | "referral" | "direct"

const META_WORDS = ["facebook", "fb", "instagram", "ig", "meta", "messenger", "fbads", "igads"]
const TIKTOK_WORDS = ["tiktok", "tt"]
const WHATSAPP_WORDS = ["whatsapp", "wa", "wasap"]
const GOOGLE_WORDS = ["google", "gads"]

/** Découpe « Instagram_Story-2 » en mots : [« instagram », « story », « 2 »]. */
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const hasWord = (s: string, list: string[]) => words(s).some((w) => list.includes(w))

/** Nom d'hôte du référent sans « www. » / « m. » / « l. » (liens sortants des applications). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}
const domainIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

export interface DetectOptions {
  /** Nom d'hôte du site (pour reconnaître une navigation interne). */
  host?: string
  /** User-Agent : sert seulement quand ni paramètre ni référent n'existent (navigateurs intégrés des applications). */
  userAgent?: string
}

/** Application d'origine d'après le User-Agent (navigateur intégré de Facebook, Instagram, TikTok). */
export function inAppSource(userAgent: string | undefined): "meta" | "tiktok" | null {
  const ua = userAgent || ""
  if (/\bInstagram\b|FBAN|FBAV|FB_IAB|FBIOS|\[FB_IAB/i.test(ua)) return "meta"
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "tiktok"
  return null
}

export function detectChannel(params: URLSearchParams, referrer: string, opts: DetectOptions = {}): Channel {
  const src = params.get("utm_source") || ""
  const medium = params.get("utm_medium") || ""
  // 1. identifiants publicitaires : preuve la plus forte
  if (params.get("fbclid")) return "meta"
  if (params.get("ttclid")) return "tiktok"
  if (params.get("gclid")) return "google"
  // 2. utm_source (mots entiers)
  if (hasWord(src, META_WORDS)) return "meta"
  if (hasWord(src, TIKTOK_WORDS)) return "tiktok"
  if (hasWord(src, WHATSAPP_WORDS)) return "whatsapp"
  if (hasWord(src, GOOGLE_WORDS)) return "google"
  if (src.trim()) return "referral" // source nommée inconnue (ex. newsletter) : on la garde dans utm_source
  void medium
  // 3. référent
  if (referrer) {
    const host = hostOf(referrer)
    if (!host) return "direct"
    if (opts.host && host === opts.host.toLowerCase()) return "direct"
    if (domainIs(host, "facebook.com") || domainIs(host, "instagram.com") || domainIs(host, "fb.com") || domainIs(host, "messenger.com") || domainIs(host, "fb.me")) return "meta"
    if (domainIs(host, "tiktok.com")) return "tiktok"
    if (domainIs(host, "whatsapp.com") || domainIs(host, "wa.me")) return "whatsapp"
    if (/(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./.test(host)) return "organic"
    return "referral"
  }
  // 4. ni paramètre ni référent : navigateur intégré d'une application ? (les applications retirent souvent le référent)
  return inAppSource(opts.userAgent) ?? "direct"
}
