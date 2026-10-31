import { NextRequest, NextResponse } from "next/server"
import { obj, str } from "@/lib/server/attribution"
import { isAdminRequest } from "@/lib/server/admin-auth"
import { dbConfigured, select, update } from "@/lib/server/db"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"

export const runtime = "nodejs"

const STATUSES = ["nouveau", "contacte", "qualifie", "reserve", "perdu"] as const
type Status = (typeof STATUSES)[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LeadRow {
  id: string
  ref: string
  first_name: string
  phone: string
  product: string
  offer: string | null
  niche: string | null
  status: Status
  tracking_consent: boolean
  visitor_id: string | null
  fbp: string | null
  fbc: string | null
  ttp: string | null
  ttclid: string | null
  ip: string | null
  user_agent: string | null
}

/**
 * POST /api/leads/status — mise à jour du statut d'un lead (clé LANDING_ADMIN_API_KEY).
 * Corps : { "ref": "E2B-XXXXXX" | "id": "<uuid>", "status": "...", "booking_value": 4800, "notes": "..." }
 * Passage à "reserve" : conversion Purchase (Meta) / CompletePayment (TikTok),
 * uniquement si le prospect avait accepté les traceurs.
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request.headers)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const ref = str(body.ref, 16)
  const id = str(body.id, 64)
  const status = str(body.status, 16) as Status | undefined
  if (id ? !UUID_RE.test(id) : !(ref && /^E2B-[A-Z0-9]{6}$/.test(ref))) {
    return NextResponse.json({ error: "ref (E2B-XXXXXX) ou id (uuid) requis" }, { status: 400 })
  }
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: `status doit être : ${STATUSES.join(", ")}` }, { status: 400 })
  }
  const bookingValue = body.booking_value === undefined ? undefined : Number(body.booking_value)
  if (bookingValue !== undefined && (!Number.isFinite(bookingValue) || bookingValue < 0 || bookingValue > 1e9)) {
    return NextResponse.json({ error: "booking_value invalide" }, { status: 400 })
  }
  if (status === "reserve" && bookingValue === undefined) {
    return NextResponse.json({ error: "booking_value requis pour une réservation" }, { status: 400 })
  }

  try {
    // ref : référence du lead, générée par le serveur et unique en base (index landing_leads_ref_uq)
    const filter = id ? `id=eq.${id}` : `ref=eq.${ref}`
    const [lead] = await select<LeadRow>("landing_leads", `${filter}&limit=1`)
    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 })

    const patch: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() }
    if (bookingValue !== undefined) patch.booking_value = bookingValue
    const notes = str(body.notes, 2000)
    if (notes) patch.notes = notes
    if (status === "reserve" && lead.status !== "reserve") patch.booked_at = new Date().toISOString()

    await update("landing_leads", `id=eq.${lead.id}`, patch)

    let conversion: "envoyée" | "sans consentement" | null = null
    if (status === "reserve" && lead.status !== "reserve") {
      if (lead.tracking_consent) {
        const event = {
          eventName: "Purchase",
          eventId: `purchase-${lead.id}`, // stable : un renvoi est dédupliqué par Meta / TikTok
          actionSource: "chat" as const,
          customData: {
            product: lead.product,
            content_category: lead.product,
            content_name: lead.offer || lead.product,
            content_ids: lead.offer || lead.product,
            value: bookingValue ?? 0,
            currency: "TND",
          },
          user: {
            visitorId: lead.visitor_id ?? undefined,
            phone: lead.phone,
            firstName: lead.first_name,
            ip: lead.ip ?? undefined,
            userAgent: lead.user_agent ?? undefined,
            fbp: lead.fbp ?? undefined,
            fbc: lead.fbc ?? undefined,
            ttp: lead.ttp ?? undefined,
            ttclid: lead.ttclid ?? undefined,
          },
        }
        await Promise.allSettled([sendMetaEvent(event), sendTikTokEvent(event)])
        conversion = "envoyée"
      } else {
        conversion = "sans consentement"
      }
    }

    return NextResponse.json({ ok: true, lead: { id: lead.id, ref: lead.ref, status }, conversion })
  } catch (e) {
    console.error("[leads/status]", e instanceof Error ? e.message : "erreur")
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
