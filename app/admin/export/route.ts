import { NextRequest, NextResponse } from "next/server"
import { currentStaff } from "@/lib/server/auth"
import { dbConfigured } from "@/lib/server/db"
import { exportLeads } from "@/lib/server/export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /admin/export — export CSV pour un membre connecté de l'équipe. */
export async function GET(request: NextRequest) {
  const staff = await currentStaff()
  if (!staff) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })
  const params = new URLSearchParams(request.nextUrl.searchParams)
  if (!params.get("format")) params.set("format", "csv")
  return exportLeads(params)
}
