// Export des leads (CSV/JSON), partagé par l'API (clé admin) et l'interface /admin (session).
import { NextResponse } from "next/server"
import { DbError, select } from "./db"

const COLUMNS = [
  "created_at", "ref", "visitor_ref", "status", "first_name", "last_name", "phone", "product", "offer", "niche",
  "destination", "travel_date", "travel_period", "adults", "children", "region", "email", "contact_channel", "budget", "message",
  "marketing_consent", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_content", "ad_id",
  "landing_page", "form_page", "source", "next_follow_up_at", "marketing_withdrawn_at", "booking_value", "booked_at",
]
const NEW_COLUMNS = ["region", "email", "contact_channel", "form_page"] // migration 0006
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

export async function exportLeads(p: URLSearchParams): Promise<NextResponse> {
  const q = ["order=created_at.desc"]
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
    // Colonnes listées une à une (jamais select=*) : l'IP, le navigateur, les identifiants publicitaires ne sont jamais lus.
    // Base pas encore migrée (0006) : repli sur l'ancienne liste, les nouvelles colonnes sortent vides.
    let raw: Record<string, unknown>[]
    try {
      raw = await select<Record<string, unknown>>("landing_leads", [`select=${COLUMNS.join(",")}`, ...q].join("&"))
    } catch (e) {
      if (!(e instanceof DbError) || e.status !== 400) throw e
      raw = await select<Record<string, unknown>>("landing_leads", [`select=${COLUMNS.filter((c) => !NEW_COLUMNS.includes(c)).join(",")}`, ...q].join("&"))
    }
    const rows = raw.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c] ?? null])))
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
