import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/server/admin-auth"
import { dbConfigured } from "@/lib/server/db"
import { exportLeads } from "@/lib/server/export"

export const runtime = "nodejs"

/**
 * GET /api/leads/export — export des leads par script (clé LANDING_ADMIN_API_KEY, en-tête uniquement).
 * Paramètres : format=csv|json, since=AAAA-MM-JJ, product, status, channel, limit (≤ 5000)
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request.headers)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })
  return exportLeads(request.nextUrl.searchParams)
}
