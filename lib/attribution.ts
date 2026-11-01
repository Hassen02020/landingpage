// Attribution des visiteurs (client uniquement).
// Sans consentement : données gardées pour la session seulement (sessionStorage),
// aucun cookie, rien n'est transmis à Meta / TikTok (voir lib/consent.ts).
// Capture les paramètres de campagne (UTM, fbclid, ttclid…) à l'arrivée sur le site,
// garde le premier contact (first touch) et le dernier contact (last touch) afin que
// chaque lead / clic WhatsApp soit rattaché à la publicité qui l'a généré.

export type Channel = "meta" | "tiktok" | "whatsapp" | "google" | "organic" | "referral" | "direct"

export interface Touch {
  channel: Channel
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  fbclid?: string
  ttclid?: string
  gclid?: string
  landing_page: string
  referrer?: string
  at: string
}

export interface Attribution {
  visitor_id: string
  ref: string
  first_touch: Touch | null
  last_touch: Touch | null
  fbp?: string
  fbc?: string
  ttp?: string
  page_url: string
  referrer?: string
}

import { hasTrackingConsent } from "./consent"

const KEY_VISITOR = "e2b_vid"
const KEY_FIRST = "e2b_ft"
const KEY_LAST = "e2b_lt"

const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ad_id",
  "adset_id",
  "campaign_id",
  "fbclid",
  "ttclid",
  "gclid",
] as const

function storageGet(key: string): string | null {
  try {
    return (hasTrackingConsent() && window.localStorage.getItem(key)) || window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    // persistance longue (localStorage) uniquement avec consentement
    if (hasTrackingConsent()) window.localStorage.setItem(key, value)
    window.sessionStorage.setItem(key, value)
  } catch {
    // stockage indisponible (navigation privée) : on continue sans persistance
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"))
  return match ? decodeURIComponent(match[1]) : undefined
}

function writeCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// Code court lisible ("E2B-7K3QFM") dérivé de l'identifiant visiteur.
// Il est ajouté aux messages WhatsApp pour relier une conversation à sa source publicitaire.
export function refFromVisitorId(vid: string): string {
  // FNV-1a 32 bits → 6 caractères base32 (sans 0/O/1/I pour éviter les confusions)
  let hash = 0x811c9dc5
  for (let i = 0; i < vid.length; i++) {
    hash ^= vid.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  let out = ""
  for (let i = 0; i < 6; i++) {
    out += alphabet[hash & 31]
    hash >>>= 5
  }
  return `E2B-${out}`
}

export function detectChannel(params: URLSearchParams, referrer: string): Channel {
  const src = (params.get("utm_source") || "").toLowerCase()
  if (params.get("fbclid") || /(facebook|fb|instagram|ig|meta|messenger)/.test(src)) return "meta"
  if (params.get("ttclid") || /tiktok/.test(src)) return "tiktok"
  if (/(whatsapp|wa)/.test(src)) return "whatsapp"
  if (params.get("gclid") || /google/.test(src)) return "google"
  if (src) return "referral"
  if (!referrer) return "direct"
  try {
    const host = new URL(referrer).hostname
    if (host === window.location.hostname) return "direct"
    if (/(facebook|instagram|fb\.|messenger)/.test(host)) return "meta"
    if (/tiktok/.test(host)) return "tiktok"
    if (/whatsapp|wa\.me/.test(host)) return "whatsapp"
    if (/(google|bing|yahoo|duckduckgo)/.test(host)) return "organic"
  } catch {
    return "direct"
  }
  return "referral"
}

function getVisitorId(): string {
  let vid = storageGet(KEY_VISITOR) || (hasTrackingConsent() ? readCookie(KEY_VISITOR) : undefined)
  if (!vid) {
    vid = randomId()
  }
  storageSet(KEY_VISITOR, vid)
  if (hasTrackingConsent()) writeCookie(KEY_VISITOR, vid, 365)
  return vid
}

// À appeler à chaque chargement de page (composant AttributionTracker du layout).
export function captureAttribution(): void {
  if (typeof window === "undefined") return
  getVisitorId()

  const params = new URLSearchParams(window.location.search)
  const referrer = document.referrer || ""
  const hasCampaignParams = PARAMS.some((p) => params.get(p))
  const isExternalReferrer = (() => {
    if (!referrer) return false
    try {
      return new URL(referrer).hostname !== window.location.hostname
    } catch {
      return false
    }
  })()

  // Meta : cookie _fbc à partir du fbclid si le pixel ne l'a pas encore créé
  const fbclid = params.get("fbclid")
  if (fbclid && hasTrackingConsent() && !readCookie("_fbc")) {
    writeCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90)
  }

  if (!hasCampaignParams && !isExternalReferrer && storageGet(KEY_FIRST)) return

  const touch: Touch = {
    channel: detectChannel(params, referrer),
    landing_page: window.location.pathname,
    referrer: referrer || undefined,
    at: new Date().toISOString(),
  }
  for (const p of PARAMS) {
    const v = params.get(p)
    if (v) touch[p] = v.slice(0, 255)
  }

  if (!storageGet(KEY_FIRST)) storageSet(KEY_FIRST, JSON.stringify(touch))
  if (hasCampaignParams || isExternalReferrer || !storageGet(KEY_LAST)) {
    storageSet(KEY_LAST, JSON.stringify(touch))
  }
}

function parseTouch(raw: string | null): Touch | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Touch
  } catch {
    return null
  }
}

export function getAttribution(): Attribution {
  const vid = getVisitorId()
  return {
    visitor_id: vid,
    ref: refFromVisitorId(vid),
    first_touch: parseTouch(storageGet(KEY_FIRST)),
    last_touch: parseTouch(storageGet(KEY_LAST)),
    fbp: hasTrackingConsent() ? readCookie("_fbp") : undefined,
    fbc: hasTrackingConsent() ? readCookie("_fbc") : undefined,
    ttp: hasTrackingConsent() ? readCookie("_ttp") : undefined,
    page_url: window.location.href,
    referrer: document.referrer || undefined,
  }
}
