import { vi } from "vitest"
import { NextRequest } from "next/server"

export interface Call {
  url: string
  method: string
  init: RequestInit
  body: any
}

export const DB_URL = "https://landing-sb.test"

/**
 * Remplace fetch : Meta, TikTok et la base Supabase des landing pages sont simulés en mémoire
 * (la base applique les mêmes règles d'unicité que la migration SQL). Rien ne sort du test.
 */
export function installFetchMock(opts: { dbStatus?: number } = {}) {
  const calls: Call[] = []
  const db: Record<string, any[]> = { landing_leads: [], landing_events: [], landing_lead_activities: [], landing_staff: [] }
  const tunisDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date())

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = String(url)
      const method = (init.method || "GET").toUpperCase()
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url: u, method, init, body })
      if (u.includes("business-api.tiktok.com")) return new Response(JSON.stringify({ code: 0 }), { status: 200 })
      if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
      if (u.startsWith(DB_URL)) {
        if (opts.dbStatus) return new Response(JSON.stringify({ code: "XX000" }), { status: opts.dbStatus })
        const { pathname, search } = new URL(u)
        const table = pathname.replace("/rest/v1/", "")
        const rows = (db[table] ??= [])
        const q = decodeURIComponent(search)
        if (method === "POST") {
          const row =
            table === "landing_leads"
              ? { id: crypto.randomUUID(), created_at: new Date().toISOString(), lead_day: tunisDay(), status: "nouveau", booked_at: null, booking_value: null, ...body }
              : { id: rows.length + 1, created_at: new Date().toISOString(), ...body }
          const conflict =
            table === "landing_leads"
              ? rows.some((r) => r.ref === row.ref || r.idempotency_key === row.idempotency_key || (r.phone === row.phone && r.product === row.product && r.lead_day === row.lead_day))
              : table === "landing_events"
                ? rows.some((r) => r.event_id === row.event_id)
                : false
          if (conflict) return new Response(JSON.stringify({ code: "23505" }), { status: 409 })
          rows.push(row)
          return new Response(JSON.stringify([row]), { status: 201 })
        }
        // filtres simulés : id, ref, idempotency_key, phone (suffisant pour ces tests)
        const eqs = Array.from(q.matchAll(/(\w+)[.=]eq\.([^,&)]+)/g))
          .map((m) => [m[1], m[2]])
          .filter(([k]) => ["id", "ref", "idempotency_key", "phone", "lead_id", "user_id"].includes(k))
        const match = (r: any) => eqs.length === 0 || eqs.some(([k, v]) => String(r[k]) === v)
        if (method === "GET") return new Response(JSON.stringify(rows.filter(match).reverse()), { status: 200 })
        if (method === "PATCH") {
          const hit = rows.filter(match)
          hit.forEach((r) => Object.assign(r, body))
          return new Response(JSON.stringify(hit), { status: 200 })
        }
      }
      return new Response("not found", { status: 404 })
    })
  )
  return {
    calls,
    db,
    meta: () => calls.filter((c) => c.url.includes("graph.facebook.com")),
    tiktok: () => calls.filter((c) => c.url.includes("business-api.tiktok.com")),
    dbCalls: () => calls.filter((c) => c.url.startsWith(DB_URL)),
  }
}

let ipCounter = 1
export function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://landing.test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "landing.test",
      origin: "https://landing.test",
      "user-agent": "vitest",
      "x-forwarded-for": `10.0.0.${ipCounter++ % 250}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
export const post = (path: string, body: unknown, headers: Record<string, string> = {}) => request("POST", path, body, headers)

export const ADMIN_KEY = "k".repeat(40)

export function configureAll() {
  vi.stubEnv("META_ACCESS_TOKEN", "meta-test-token")
  vi.stubEnv("META_PIXEL_ID", "111")
  vi.stubEnv("TIKTOK_ACCESS_TOKEN", "tt-test-token")
  vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIXEL")
  vi.stubEnv("LANDING_SUPABASE_URL", DB_URL)
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
  vi.stubEnv("LANDING_ADMIN_API_KEY", ADMIN_KEY)
}
