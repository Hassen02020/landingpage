import { vi } from "vitest"
import { NextRequest } from "next/server"

export interface Call {
  url: string
  init: RequestInit
  body: any
}

/** Remplace fetch : Meta, TikTok et CRM répondent OK, rien ne sort du test. */
export function installFetchMock(opts: { crmStatus?: number } = {}) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = String(url)
      calls.push({ url: u, init, body: init.body ? JSON.parse(String(init.body)) : undefined })
      if (u.includes("business-api.tiktok.com")) return new Response(JSON.stringify({ code: 0 }), { status: 200 })
      if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
      if (u.startsWith("https://crm.test")) return new Response("{}", { status: opts.crmStatus ?? 200 })
      return new Response("not found", { status: 404 })
    })
  )
  return {
    calls,
    meta: () => calls.filter((c) => c.url.includes("graph.facebook.com")),
    tiktok: () => calls.filter((c) => c.url.includes("business-api.tiktok.com")),
    crm: () => calls.filter((c) => c.url.startsWith("https://crm.test")),
  }
}

let ipCounter = 1
export function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://landing.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "landing.test",
      origin: "https://landing.test",
      "user-agent": "vitest",
      "x-forwarded-for": `10.0.0.${ipCounter++ % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

export function configureAll() {
  vi.stubEnv("META_ACCESS_TOKEN", "meta-test-token")
  vi.stubEnv("META_PIXEL_ID", "111")
  vi.stubEnv("TIKTOK_ACCESS_TOKEN", "tt-test-token")
  vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIXEL")
  vi.stubEnv("EASYV4_LEAD_INTAKE_URL", "https://crm.test/api/public/leads")
  vi.stubEnv("EASYV4_LEAD_INTAKE_TOKEN", "crm-secret")
}
