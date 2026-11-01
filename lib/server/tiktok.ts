// TikTok Events API (serveur) — https://business-api.tiktok.com/portal/docs?id=1771100865818625
import { sha256 } from "./hash"
import type { ServerEvent } from "./meta"
import { resolveIntegration } from "./integrations"

// Correspondance événements Meta → événements standard TikTok
const EVENT_MAP: Record<string, string> = {
  ViewContent: "ViewContent",
  Contact: "Contact",
  Lead: "SubmitForm",
  CompleteRegistration: "CompleteRegistration",
  Purchase: "CompletePayment",
  Search: "Search",
}

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN && (process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID))
}

export async function sendTikTokEvent(event: ServerEvent): Promise<{ ok: boolean; skipped?: boolean; error?: unknown }> {
  const ttEvent = EVENT_MAP[event.eventName]
  if (!ttEvent) return { ok: false, skipped: true }
  // réglage /admin/integrations, à défaut variables Vercel
  const cfg = await resolveIntegration("tiktok")
  const token = cfg.token
  const pixelId = cfg.pixelId
  if (!cfg.enabled || !token || !pixelId) return { ok: false, skipped: true }

  const { user, customData = {} } = event
  const userData: Record<string, unknown> = {}
  if (user.ttclid) userData.ttclid = user.ttclid
  if (user.ttp) userData.ttp = user.ttp
  if (user.ip) userData.ip = user.ip
  if (user.userAgent) userData.user_agent = user.userAgent
  if (user.visitorId) userData.external_id = sha256(user.visitorId)
  if (user.phone) userData.phone = sha256(`+${user.phone}`)
  if (user.email) userData.email = sha256(user.email)

  const value = typeof customData.value === "number" ? customData.value : undefined
  const payload: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: ttEvent,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        user: userData,
        page: event.pageUrl ? { url: event.pageUrl, referrer: event.referrer } : undefined,
        properties: {
          currency: (customData.currency as string) || "TND",
          value,
          content_type: "product",
          contents: [
            {
              content_id: String(customData.content_ids || customData.product || ""),
              content_name: String(customData.content_name || ""),
              content_category: String(customData.content_category || ""),
            },
          ],
        },
      },
    ],
  }
  if (cfg.testEventCode) payload.test_event_code = cfg.testEventCode

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string }
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      console.error("[tiktok-events]", event.eventName, json)
      return { ok: false, error: json }
    }
    return { ok: true }
  } catch (error) {
    console.error("[tiktok-events]", error)
    return { ok: false, error }
  }
}
