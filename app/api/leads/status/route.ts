import { NextRequest, NextResponse } from "next/server"
import { obj, str } from "@/lib/server/attribution"
import { isAuthorizedCrmRequest, pushToCrm } from "@/lib/server/crm"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { selectRows, supabaseConfigured, updateRows } from "@/lib/server/supabase"

export const runtime = "nodejs"

const STATUSES = ["nouveau", "contacte", "qualifie", "reserve", "perdu"] as const
type Status = (typeof STATUSES)[number]

interface LeadRow {
  id: string
  ref: string
  name: string
  phone: string
  product: string
  offer?: string
  niche?: string
  status: Status
  visitor_id?: string
  fbp?: string
  fbc?: string
  ttp?: string
  ttclid?: string
  ip?: string
  user_agent?: string
  page_url?: string
}

/**
 * POST /api/leads/status — mise à jour du statut d'un lead depuis le CRM (protégé par CRM_API_KEY).
 * Corps : { "ref": "E2B-XXXXXX" | "id": "<uuid>", "status": "contacte|qualifie|reserve|perdu",
 *           "booking_value": 4800, "notes": "..." }
 *
 * Quand un lead passe à "reserve", un événement "Purchase" (Meta) / "CompletePayment" (TikTok)
 * est envoyé avec la valeur de la réservation : les campagnes s'optimisent alors sur les
 * vraies réservations et non sur les simples clics.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCrmRequest(request.headers)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const ref = str(body.ref, 16)
  const id = str(body.id, 64)
  const status = str(body.status, 16) as Status | undefined
  if (!ref && !id) return NextResponse.json({ error: "ref ou id requis" }, { status: 400 })
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: `status doit être : ${STATUSES.join(", ")}` }, { status: 400 })
  }
  const bookingValue = body.booking_value === undefined ? undefined : Number(body.booking_value)
  if (bookingValue !== undefined && (!Number.isFinite(bookingValue) || bookingValue < 0)) {
    return NextResponse.json({ error: "booking_value invalide" }, { status: 400 })
  }

  // Un même visiteur peut avoir plusieurs leads avec la même réf : on cible le plus récent.
  const filter = id ? `id=eq.${encodeURIComponent(id)}` : `ref=eq.${encodeURIComponent(ref!)}`
  const found = await selectRows<LeadRow>("leads", `${filter}&order=created_at.desc&limit=1`)
  const lead = found[0]
  if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 })

  const patch: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() }
  if (bookingValue !== undefined) patch.booking_value = bookingValue
  const notes = str(body.notes, 2000)
  if (notes) patch.notes = notes
  if (status === "reserve") patch.booked_at = new Date().toISOString()

  const [updated] = await updateRows<LeadRow>("leads", `id=eq.${encodeURIComponent(lead.id)}`, patch)

  let conversion: unknown = null
  if (status === "reserve" && lead.status !== "reserve") {
    const event = {
      eventName: "Purchase",
      eventId: `purchase-${lead.id}`,
      actionSource: "chat" as const,
      customData: {
        product: lead.product,
        content_category: lead.product,
        content_name: lead.offer || lead.product,
        content_ids: lead.offer || lead.product,
        niche: lead.niche,
        value: bookingValue ?? 0,
        currency: "TND",
      },
      user: {
        visitorId: lead.visitor_id,
        phone: lead.phone,
        firstName: lead.name?.split(/\s+/)[0],
        ip: lead.ip,
        userAgent: lead.user_agent,
        fbp: lead.fbp,
        fbc: lead.fbc,
        ttp: lead.ttp,
        ttclid: lead.ttclid,
      },
    }
    const [meta, tiktok] = await Promise.all([sendMetaEvent(event), sendTikTokEvent(event)])
    conversion = { meta: meta.ok || (meta.skipped ? "non configuré" : false), tiktok: tiktok.ok || (tiktok.skipped ? "non configuré" : false) }
  }

  await pushToCrm("lead.updated", { id: lead.id, ref: lead.ref, ...patch })
  return NextResponse.json({ ok: true, lead: { id: updated?.id ?? lead.id, ref: lead.ref, status }, conversion })
}
