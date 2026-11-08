import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited, rememberOnce } from "@/lib/server/guard"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { ALLOWED_EVENTS, LOGGED_EVENTS } from "@/lib/server/events"
import { currentOrgKey, dbConfigured, insertQuiet, withPublicOrg } from "@/lib/server/db"
import { isProduct } from "@/lib/config"

export const runtime = "nodejs"

/**
 * POST /api/track — relais serveur (Meta Conversions API + TikTok Events API)
 * des événements du pixel navigateur, avec le même event_id (déduplication).
 * N'envoie rien sans consentement explicite aux traceurs.
 */
async function handlePOST(request: NextRequest) {
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
  if (rememberOnce(["track", (await currentOrgKey()) ?? "none", eventId], "1", 60 * 60 * 1000)) {
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

  const tasks: Promise<unknown>[] = [sendMetaEvent(serverEvent), sendTikTokEvent(serverEvent)]

  // Journal des interactions (visiteurs consentants) pour tester les niches
  if (LOGGED_EVENTS.has(eventName) && dbConfigured()) {
    const product = customData.product
    tasks.push(
      insertQuiet("landing_events", {
        event_name: eventName,
        event_id: eventId,
        visitor_id: attr.visitor_id ?? null,
        visitor_ref: attr.ref ?? null,
        product: isProduct(product) ? product : null,
        offer: str(customData.content_ids) || null,
        niche: str(customData.niche, 64) || null,
        location: str(customData.content_name) || null,
        channel: attr.channel ?? null,
        utm_source: attr.utm_source ?? null,
        utm_campaign: attr.utm_campaign ?? null,
        utm_content: attr.utm_content ?? null,
        ad_id: attr.ad_id ?? null,
      }).catch((e) => console.error("[track] journal", e instanceof Error ? e.message : "erreur"))
    )
  }

  await Promise.allSettled(tasks)
  return NextResponse.json({ ok: true, forwarded: true })
}

// Point d'entrée rattaché explicitement à l'organisation du site public (contexte passant AVANT toute session) :
// formulaire, suivi et scripts à clé d'API travaillent pour Easy2Book, jamais pour l'organisation d'un compte qui visite le site.
export const POST = (request: NextRequest) => withPublicOrg(() => handlePOST(request))
