import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/server/admin-auth"
import { dbConfigured, withPublicOrg } from "@/lib/server/db"
import { exportLeads } from "@/lib/server/export"

export const runtime = "nodejs"

/**
 * GET /api/leads/export — export des leads par script (clé LANDING_ADMIN_API_KEY, en-tête uniquement).
 * Paramètres : format=csv|json, since=AAAA-MM-JJ, product, status, channel, limit (≤ 5000)
 */
async function handleGET(request: NextRequest) {
  if (!isAdminRequest(request.headers)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })
  return exportLeads(request.nextUrl.searchParams)
}

// Point d'entrée rattaché explicitement à l'organisation du site public (contexte passant AVANT toute session) :
// formulaire, suivi et scripts à clé d'API travaillent pour Easy2Book, jamais pour l'organisation d'un compte qui visite le site.
export const GET = (request: NextRequest) => withPublicOrg(() => handleGET(request))
