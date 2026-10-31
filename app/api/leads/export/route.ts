import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/server/admin-auth"
import { dbConfigured, select } from "@/lib/server/db"

export const runtime = "nodejs"

const COLUMNS = [
  "created_at", "ref", "visitor_ref", "status", "first_name", "last_name", "phone", "product", "offer", "niche",
  "destination", "travel_date", "travel_period", "adults", "children", "budget", "message",
  "marketing_consent", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_content", "ad_id",
  "landing_page", "booking_value", "booked_at",
]
const FILTERS: Record<string, RegExp> = {
  product: /^(omra|voyage|hotel|autre)$/,
  status: /^(nouveau|contacte|qualifie|reserve|perdu)$/,
  channel: /^[a-z_]{1,32}$/,
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // neutralise les formules Excel
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/leads/export — export des leads (clé LANDING_ADMIN_API_KEY, en-tête uniquement).
 * Paramètres : format=csv|json, since=AAAA-MM-JJ, product, status, channel, limit (≤ 5000)
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request.headers)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: "Base non configurée" }, { status: 503 })

  const p = request.nextUrl.searchParams
  const q = [`select=${COLUMNS.join(",")}`, "order=created_at.desc"]
  const since = p.get("since")
  if (since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return NextResponse.json({ error: "since invalide" }, { status: 400 })
    q.push(`created_at=gte.${since}`)
  }
  for (const [key, re] of Object.entries(FILTERS)) {
    const v = p.get(key)
    if (!v) continue
    if (!re.test(v)) return NextResponse.json({ error: `${key} invalide` }, { status: 400 })
    q.push(`${key}=eq.${v}`)
  }
  const limit = Math.min(5000, Math.max(1, parseInt(p.get("limit") || "1000", 10) || 1000))
  q.push(`limit=${limit}`)

  try {
    const rows = await select<Record<string, unknown>>("landing_leads", q.join("&"))
    if (p.get("format") === "csv") {
      const csv = [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n")
      return new NextResponse("﻿" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads-landing-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      })
    }
    return NextResponse.json({ count: rows.length, leads: rows }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    console.error("[leads/export]", e instanceof Error ? e.message : "erreur")
    return NextResponse.json({ error: "Erreur d'export" }, { status: 500 })
  }
}
