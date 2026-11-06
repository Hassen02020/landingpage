// Tracking unifié (client) : Meta Pixel + TikTok Pixel + serveur (/api/track).
// Le serveur relaie l'événement vers Meta Conversions API et TikTok Events API
// avec le même event_id, ce qui permet la déduplication navigateur/serveur.

import { getAttribution } from "./attribution"
import { hasTrackingConsent } from "./consent"
import { WHATSAPP_NUMBER, type Product } from "./config"
import { waText } from "./wa-text"

type Fbq = (...args: unknown[]) => void
interface Ttq {
  track: (event: string, props?: Record<string, unknown>, opts?: Record<string, unknown>) => void
  identify?: (data: Record<string, unknown>) => void
}

declare global {
  interface Window {
    fbq?: Fbq
    ttq?: Ttq
  }
}

const META_STANDARD_EVENTS = new Set([
  "AddPaymentInfo",
  "AddToCart",
  "CompleteRegistration",
  "Contact",
  "InitiateCheckout",
  "Lead",
  "Purchase",
  "Schedule",
  "Search",
  "SubmitApplication",
  "ViewContent",
])

// Correspondance événements Meta → événements standard TikTok
const TIKTOK_EVENT_MAP: Record<string, string> = {
  ViewContent: "ViewContent",
  Contact: "Contact",
  Lead: "SubmitForm",
  CompleteRegistration: "CompleteRegistration",
  Purchase: "CompletePayment",
  Search: "Search",
}

export function generateEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

export interface TrackOptions {
  eventId?: string
  /** true si le serveur a déjà envoyé l'événement (ex. Lead via /api/leads) */
  skipServer?: boolean
}

/**
 * Envoie un événement au Pixel Meta, au Pixel TikTok et au serveur.
 * Ne lève jamais d'erreur : le tracking ne doit pas bloquer la navigation.
 */
export function trackEvent(
  eventName: string,
  customData: Record<string, unknown> = {},
  options: TrackOptions = {}
): string {
  const eventId = options.eventId || generateEventId()
  if (typeof window === "undefined") return eventId
  // Sans consentement : rien n'est envoyé à Meta, TikTok ni au serveur.
  if (!hasTrackingConsent()) return eventId

  let attribution
  try {
    attribution = getAttribution()
  } catch {
    attribution = undefined
  }
  const data = { ...customData, ref: attribution?.ref }

  try {
    if (typeof window.fbq === "function") {
      const method = META_STANDARD_EVENTS.has(eventName) ? "track" : "trackCustom"
      // Le 4e argument { eventID } est indispensable pour la déduplication avec la CAPI
      window.fbq(method, eventName, data, { eventID: eventId })
    }
  } catch {
    /* ignore */
  }

  try {
    const ttEvent = TIKTOK_EVENT_MAP[eventName]
    if (ttEvent && window.ttq) {
      window.ttq.track(
        ttEvent,
        {
          content_type: "product",
          content_id: String(customData.content_ids || customData.content_name || ""),
          content_name: String(customData.content_name || ""),
          content_category: String(customData.content_category || ""),
          value: typeof customData.value === "number" ? customData.value : undefined,
          currency: (customData.currency as string) || "TND",
        },
        { event_id: eventId }
      )
    }
  } catch {
    /* ignore */
  }

  if (options.skipServer) return eventId

  try {
    const body = JSON.stringify({ eventName, eventId, customData: data, attribution, consent: "granted" })
    // keepalive : l'envoi survit à l'ouverture de WhatsApp / au changement de page
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }

  return eventId
}

export interface WhatsAppContext {
  product: Product
  location: string
  offer?: string
  niche?: string
  value?: number
}

/** Construit un lien WhatsApp avec le code de référence du visiteur en fin de message. */
export function buildWhatsAppUrl(message: string, ref?: string): string {
  const text = ref ? `${message}\n\nRéf: ${ref}` : message
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText(text))}`
}

/**
 * Gestionnaire onClick pour les liens WhatsApp :
 * - ajoute le code de référence au message (pour relier la conversation à la pub)
 * - envoie l'événement "Contact" à Meta, TikTok et au CRM.
 */
export function handleWhatsAppClick(
  event: { currentTarget: HTMLAnchorElement },
  context: WhatsAppContext
): void {
  let ref: string | undefined
  try {
    ref = getAttribution().ref
    const anchor = event.currentTarget
    const url = new URL(anchor.href)
    const text = url.searchParams.get("text") || ""
    if (ref && !text.includes(ref)) {
      url.searchParams.set("text", waText(`${text || "Bonjour Easy2Book"}\n\nRéf: ${ref}`))
      anchor.href = url.toString()
    }
  } catch {
    /* le lien d'origine reste utilisable */
  }

  trackEvent("Contact", {
    channel: "whatsapp",
    product: context.product,
    content_category: context.product,
    content_name: context.location,
    content_ids: context.offer || "",
    niche: context.niche,
    value: context.value,
    currency: "TND",
  })
}
