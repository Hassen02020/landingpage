import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited, rememberOnce } from "@/lib/server/guard"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { ALLOWED_EVENTS } from "@/lib/server/events"

export const runtime = "nodejs"

/**
 * POST /api/track — relais serveur (Meta Conversions API + TikTok Events API)
 * des événements du pixel navigateur, avec le même event_id (déduplication).
 * N'envoie rien sans consentement explicite aux traceurs.
 */
export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const eventName = str(body.eventName, 64)
  const eventId = str(body.eventId, 64)
  if (!eventName || !ALLOWED_EVENTS.has(eventName) || !eventId || !/^[A-Za-z0-9-]{8,64}$/.test(eventId)) {
    return NextResponse.json({ error: "Événement non autorisé" }, { status: 400 })
  }

  // Sans consentement : on accepte la requête mais rien ne part chez Meta / TikTok.
  if (body.consent !== "granted") return NextResponse.json({ ok: true, forwarded: false })

  const ip = clientIp(request.headers)
  if (rateLimited(ip && `track:${ip}`, 120, 60 * 1000)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
  }
  // un même event_id n'est relayé qu'une fois
  if (rememberOnce(["track", eventId], "1", 60 * 60 * 1000)) {
    return NextResponse.json({ ok: true, forwarded: false, duplicate: true })
  }

  const rawData = obj(body.customData)
  // seules des valeurs simples et courtes sont relayées
  const customData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawData).slice(0, 20)) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue
    if (typeof v === "number" && Number.isFinite(v)) customData[k] = v
    else if (typeof v === "string") customData[k] = v.slice(0, 200)
  }

  const attr = flattenAttribution(body.attribution)
  const serverEvent = {
    eventName,
    eventId,
    pageUrl: attr.page_url,
    referrer: attr.referrer,
    customData,
    user: {
      visitorId: attr.visitor_id,
      ip,
      userAgent: request.headers.get("user-agent") || undefined,
      fbp: attr.fbp,
      fbc: attr.fbc,
      ttp: attr.ttp,
      ttclid: attr.ttclid,
    },
  }

  await Promise.allSettled([sendMetaEvent(serverEvent), sendTikTokEvent(serverEvent)])
  return NextResponse.json({ ok: true, forwarded: true })
}
