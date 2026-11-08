import { NextRequest, NextResponse } from "next/server"
import { currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { dbConfigured } from "@/lib/server/db"
import { exportLeads } from "@/lib/server/export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /admin/export — export CSV réservé aux ADMINISTRATEURS connectés (rôle « admin »). */
export async function GET(request: NextRequest) {
  const staff = await currentStaff()
  if (!staff) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!can(staff.orgRole, "data.export")) return NextResponse.json({ error: "Export réservé aux administrateurs" }, { status: 403 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })
  const params = new URLSearchParams(request.nextUrl.searchParams)
  if (!params.get("format")) params.set("format", "csv")
  return exportLeads(params)
}
