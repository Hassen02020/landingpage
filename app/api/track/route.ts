import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp } from "@/lib/server/hash"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { insertRowQuiet, supabaseConfigured } from "@/lib/server/supabase"

export const runtime = "nodejs"

// Événements enregistrés dans Supabase (table "events") pour analyser les niches.
// Les événements d'engagement (scroll, temps passé) ne sont envoyés qu'aux pixels.
const LOGGED_EVENTS = new Set(["Contact", "ViewContent", "CategoryView", "HotelClick", "PackageClick", "TripClick"])

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const eventName = str(body.eventName, 64)
  const eventId = str(body.eventId, 64)
  if (!eventName || !/^[A-Za-z][A-Za-z0-9_]*$/.test(eventName) || !eventId) {
    return NextResponse.json({ error: "eventName et eventId requis" }, { status: 400 })
  }

  const customData = obj(body.customData)
  const attr = flattenAttribution(body.attribution)
  const user = {
    visitorId: attr.visitor_id,
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent") || undefined,
    fbp: attr.fbp,
    fbc: attr.fbc,
    ttp: attr.ttp,
    ttclid: attr.ttclid,
  }
  const serverEvent = {
    eventName,
    eventId,
    pageUrl: attr.page_url,
    referrer: attr.referrer,
    customData,
    user,
  }

  const tasks: Promise<unknown>[] = [sendMetaEvent(serverEvent), sendTikTokEvent(serverEvent)]

  if (LOGGED_EVENTS.has(eventName) && supabaseConfigured()) {
    tasks.push(
      insertRowQuiet("events", {
        event_name: eventName,
        event_id: eventId,
        visitor_id: attr.visitor_id,
        ref: attr.ref,
        product: str(customData.product, 32) || str(customData.content_category, 64),
        offer: str(customData.content_ids) || undefined,
        niche: str(customData.niche, 64) || str(customData.category_id, 64),
        location: str(customData.content_name),
        channel: attr.channel,
        utm_source: attr.utm_source,
        utm_campaign: attr.utm_campaign,
        utm_content: attr.utm_content,
        ad_id: attr.ad_id,
        page_url: attr.page_url,
      }).catch((e) => console.error("[track] supabase", e))
    )
  }

  await Promise.allSettled(tasks)
  return NextResponse.json({ ok: true })
}
