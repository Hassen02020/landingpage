import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp, normalizePhone, randomRef } from "@/lib/server/hash"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { insertRow, selectRows, supabaseConfigured } from "@/lib/server/supabase"
import { isAuthorizedCrmRequest, pushToCrm } from "@/lib/server/crm"
import { PRODUCTS, isProduct, WHATSAPP_NUMBER } from "@/lib/config"

export const runtime = "nodejs"

// Limitation simple anti-spam : 5 envois / 10 min par IP (par instance serverless)
const hits = new Map<string, number[]>()
function rateLimited(ip: string | undefined): boolean {
  if (!ip) return false
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > 5
}

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * POST /api/leads — enregistre un lead venant d'un formulaire des landing pages.
 * 1. validation (téléphone tunisien ou international, consentement, anti-spam)
 * 2. enregistrement Supabase avec toute l'attribution publicitaire
 * 3. événement "Lead" vers Meta CAPI + TikTok Events API (dédupliqué avec le navigateur)
 * 4. envoi au CRM Easy2Book (webhook)
 * Retourne le code de référence et le lien WhatsApp pré-rempli.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  // Champ piège invisible : rempli uniquement par les robots
  if (str(body.website)) return NextResponse.json({ ok: true, ref: randomRef() })

  const ip = clientIp(request.headers)
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Trop de demandes. Contactez-nous directement sur WhatsApp." }, { status: 429 })
  }

  const name = str(body.name, 80)
  const phone = normalizePhone(String(body.phone ?? ""))
  const product = isProduct(body.product) ? body.product : "autre"
  const consent = body.consent === true

  const errors: Record<string, string> = {}
  if (!name || name.length < 2) errors.name = "Nom requis"
  if (!phone) errors.phone = "Numéro invalide : 8 chiffres (ex. 98 140 514) ou format international (+33…)"
  if (!consent) errors.consent = "Merci d'accepter d'être recontacté"
  if (Object.keys(errors).length) return NextResponse.json({ error: "Formulaire incomplet", errors }, { status: 422 })

  const attr = flattenAttribution(body.attribution)
  const ref = attr.ref || randomRef()
  const eventId = str(body.eventId, 64) || crypto.randomUUID()
  const travelDate = str(body.travel_date, 10)
  const userAgent = request.headers.get("user-agent") || undefined
  const [firstName, ...rest] = name!.split(/\s+/)

  const lead = {
    ref,
    name,
    phone,
    product,
    offer: str(body.offer),
    niche: str(body.niche, 64),
    destination: str(body.destination),
    travel_date: travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? travelDate : null,
    travel_period: str(body.travel_period, 64),
    adults: int(body.adults, 1, 50, 1),
    children: int(body.children, 0, 20, 0),
    budget: str(body.budget, 64),
    trip_type: str(body.trip_type, 64),
    message: str(body.message, 1000),
    consent,
    status: "nouveau",
    source: "landing_easy2book",
    meta_event_id: eventId,
    ip,
    user_agent: userAgent?.slice(0, 500),
    ...attr,
  }

  let saved: Record<string, unknown> | null = null
  if (supabaseConfigured()) {
    try {
      saved = await insertRow("leads", lead)
    } catch (e) {
      // on ne bloque pas le prospect : le lead part quand même au CRM et sur WhatsApp
      console.error("[leads] supabase", e)
    }
  } else {
    console.warn("[leads] Supabase non configuré — lead non stocké en base", { ref, product })
  }

  const serverEvent = {
    eventName: "Lead",
    eventId,
    pageUrl: attr.page_url,
    referrer: attr.referrer,
    customData: {
      product,
      content_category: product,
      content_name: lead.offer || PRODUCTS[product],
      content_ids: lead.offer || product,
      niche: lead.niche,
      currency: "TND",
      value: 1,
    },
    user: {
      visitorId: attr.visitor_id,
      phone: phone!,
      firstName,
      lastName: rest.join(" ") || undefined,
      ip,
      userAgent,
      fbp: attr.fbp,
      fbc: attr.fbc,
      ttp: attr.ttp,
      ttclid: attr.ttclid,
    },
  }

  const crmPayload = { id: saved?.id ?? null, created_at: saved?.created_at ?? new Date().toISOString(), ...lead }
  delete (crmPayload as Record<string, unknown>).ip
  delete (crmPayload as Record<string, unknown>).user_agent

  await Promise.allSettled([sendMetaEvent(serverEvent), sendTikTokEvent(serverEvent), pushToCrm("lead.created", crmPayload)])

  const summary = [
    `Bonjour Easy2Book 👋 je souhaite réserver : ${PRODUCTS[product]}${lead.offer ? ` — ${lead.offer}` : ""}`,
    `Nom : ${name}`,
    lead.destination ? `Destination : ${lead.destination}` : null,
    lead.travel_date ? `Date : ${lead.travel_date}` : lead.travel_period ? `Période : ${lead.travel_period}` : null,
    `Voyageurs : ${lead.adults} adulte(s)${lead.children ? ` + ${lead.children} enfant(s)` : ""}`,
    lead.budget ? `Budget : ${lead.budget}` : null,
    lead.message ? `Message : ${lead.message}` : null,
    "",
    `Réf: ${ref}`,
  ]
    .filter((l) => l !== null)
    .join("\n")

  return NextResponse.json({
    ok: true,
    ref,
    stored: Boolean(saved),
    whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary)}`,
  })
}

const EXPORT_COLUMNS = [
  "created_at",
  "ref",
  "status",
  "name",
  "phone",
  "product",
  "offer",
  "niche",
  "destination",
  "travel_date",
  "travel_period",
  "adults",
  "children",
  "budget",
  "message",
  "channel",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "ad_id",
  "landing_page",
  "booking_value",
  "booked_at",
]

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  let s = String(v)
  // neutralise les formules Excel
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/leads — export des leads pour le CRM (protégé par CRM_API_KEY).
 * Paramètres : format=csv|json, since=YYYY-MM-DD, product, status, channel, limit (max 5000)
 * Auth : en-tête "x-api-key: <CRM_API_KEY>" ou "Authorization: Bearer <CRM_API_KEY>".
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  if (!isAuthorizedCrmRequest(request.headers, params)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })

  const filters: string[] = [`select=${EXPORT_COLUMNS.join(",")}`, "order=created_at.desc"]
  const since = params.get("since")
  if (since && /^\d{4}-\d{2}-\d{2}/.test(since)) filters.push(`created_at=gte.${encodeURIComponent(since)}`)
  for (const key of ["product", "status", "channel", "utm_campaign", "niche"]) {
    const v = params.get(key)
    if (v) filters.push(`${key}=eq.${encodeURIComponent(v)}`)
  }
  filters.push(`limit=${int(params.get("limit"), 1, 5000, 1000)}`)

  try {
    const rows = await selectRows<Record<string, unknown>>("leads", filters.join("&"))
    if (params.get("format") === "csv") {
      const csv = [EXPORT_COLUMNS.join(","), ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n")
      return new NextResponse("﻿" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads-easy2book-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }
    return NextResponse.json({ count: rows.length, leads: rows })
  } catch (e) {
    console.error("[leads] export", e)
    return NextResponse.json({ error: "Erreur d'export" }, { status: 500 })
  }
}
