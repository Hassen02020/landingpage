import { NextRequest, NextResponse } from "next/server"
import { obj, str } from "@/lib/server/attribution"
import { isAdminRequest } from "@/lib/server/admin-auth"
import { dbConfigured, withPublicOrg } from "@/lib/server/db"
import { STATUSES, UUID_RE, changeStatus, getLead, getLeadByRef, isStatus } from "@/lib/server/crm"
import { isBooking } from "@/lib/status"

export const runtime = "nodejs"

/**
 * POST /api/leads/status — mise à jour du statut d'un lead par script (clé LANDING_ADMIN_API_KEY).
 * L'équipe utilise de préférence l'interface /admin. Même logique que l'interface (lib/server/crm.ts) :
 * historique tracé, conversion Purchase / CompletePayment envoyée une seule fois, avec consentement.
 * Corps : { "ref": "E2B-XXXXXX" | "id": "<uuid>", "status": "...", "booking_value": 4800, "notes": "..." }
 */
async function handlePOST(request: NextRequest) {
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
  const status = str(body.status, 16)
  if (id ? !UUID_RE.test(id) : !(ref && /^E2B-[A-Z0-9]{6}$/.test(ref))) {
    return NextResponse.json({ error: "ref (E2B-XXXXXX) ou id (uuid) requis" }, { status: 400 })
  }
  if (!isStatus(status)) return NextResponse.json({ error: `status doit être : ${STATUSES.join(", ")}` }, { status: 400 })
  const bookingValue = body.booking_value === undefined ? undefined : Number(body.booking_value)
  if (bookingValue !== undefined && (!Number.isFinite(bookingValue) || bookingValue < 0 || bookingValue > 1e9)) {
    return NextResponse.json({ error: "booking_value invalide" }, { status: 400 })
  }
  if (isBooking(status) && bookingValue === undefined) {
    return NextResponse.json({ error: "booking_value requis pour une réservation ou un dossier gagné" }, { status: 400 })
  }

  try {
    const lead = id ? await getLead(id) : await getLeadByRef(ref!)
    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 })
    const result = await changeStatus(lead, status, { id: null, label: "API" }, { bookingValue, notes: str(body.notes, 2000) })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
    return NextResponse.json({ ok: true, lead: { id: lead.id, ref: lead.ref, status }, conversion: result.conversion })
  } catch (e) {
    console.error("[leads/status]", e instanceof Error ? e.message : "erreur")
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// Point d'entrée rattaché explicitement à l'organisation du site public (contexte passant AVANT toute session) :
// formulaire, suivi et scripts à clé d'API travaillent pour Easy2Book, jamais pour l'organisation d'un compte qui visite le site.
export const POST = (request: NextRequest) => withPublicOrg(() => handlePOST(request))
