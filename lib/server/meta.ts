// Meta Conversions API (serveur) — https://developers.facebook.com/docs/marketing-api/conversions-api
import { sha256 } from "./hash"

const GRAPH_VERSION = "v21.0"

export interface ServerUser {
  visitorId?: string
  phone?: string // chiffres internationaux, ex. 21698140514
  firstName?: string
  lastName?: string
  email?: string
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
  ttp?: string
  ttclid?: string
}

export interface ServerEvent {
  eventName: string
  eventId: string
  eventTime?: number
  pageUrl?: string
  referrer?: string
  // "website" pour la navigation, "chat" pour une réservation confirmée sur WhatsApp
  actionSource?: "website" | "chat" | "phone_call" | "system_generated"
  customData?: Record<string, unknown>
  user: ServerUser
}

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN)
}

function metaUserData(user: ServerUser) {
  const data: Record<string, unknown> = {}
  if (user.ip) data.client_ip_address = user.ip
  if (user.userAgent) data.client_user_agent = user.userAgent
  if (user.fbp) data.fbp = user.fbp
  if (user.fbc) data.fbc = user.fbc
  if (user.visitorId) data.external_id = [sha256(user.visitorId)]
  if (user.phone) data.ph = [sha256(user.phone)]
  if (user.email) data.em = [sha256(user.email)]
  if (user.firstName) data.fn = [sha256(user.firstName)]
  if (user.lastName) data.ln = [sha256(user.lastName)]
  if (user.phone?.startsWith("216")) data.country = [sha256("tn")]
  return data
}

export async function sendMetaEvent(event: ServerEvent): Promise<{ ok: boolean; skipped?: boolean; error?: unknown }> {
  const token = process.env.META_ACCESS_TOKEN
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1674012850599992"
  if (!token) return { ok: false, skipped: true }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_id: event.eventId,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        action_source: event.actionSource || "website",
        event_source_url: event.actionSource && event.actionSource !== "website" ? undefined : event.pageUrl,
        user_data: metaUserData(event.user),
        custom_data: event.customData,
      },
    ],
  }
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE
  // jeton dans le corps (et non dans l'URL) pour ne pas l'exposer dans les journaux
  payload.access_token = token

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    if (!res.ok) {
      const error = await res.json().catch(() => res.statusText)
      console.error("[meta-capi]", event.eventName, error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (error) {
    console.error("[meta-capi]", error)
    return { ok: false, error }
  }
}
