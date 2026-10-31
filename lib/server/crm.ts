// Envoi des leads vers le CRM Easy2Book via webhook (n'importe quel CRM / Make / Zapier / n8n).
// Si CRM_WEBHOOK_SECRET est défini, le corps est signé (HMAC-SHA256) dans l'en-tête X-E2B-Signature.
import { hmacSha256 } from "./hash"

export function crmConfigured(): boolean {
  return Boolean(process.env.CRM_WEBHOOK_URL)
}

export async function pushToCrm(type: "lead.created" | "lead.updated", data: Record<string, unknown>): Promise<{ ok: boolean; skipped?: boolean }> {
  const url = process.env.CRM_WEBHOOK_URL
  if (!url) return { ok: false, skipped: true }

  const body = JSON.stringify({ type, source: "landing_easy2book", sent_at: new Date().toISOString(), data })
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.CRM_WEBHOOK_SECRET) headers["X-E2B-Signature"] = hmacSha256(process.env.CRM_WEBHOOK_SECRET, body)

  try {
    const res = await fetch(url, { method: "POST", headers, body, cache: "no-store" })
    if (!res.ok) console.error("[crm-webhook]", res.status, await res.text().catch(() => ""))
    return { ok: res.ok }
  } catch (error) {
    console.error("[crm-webhook]", error)
    return { ok: false }
  }
}

/** Vérifie la clé d'API des endpoints réservés au CRM (export / mise à jour de statut). */
export function isAuthorizedCrmRequest(headers: Headers, searchParams?: URLSearchParams): boolean {
  const expected = process.env.CRM_API_KEY
  if (!expected) return false
  const auth = headers.get("authorization")
  const provided = headers.get("x-api-key") || (auth?.startsWith("Bearer ") ? auth.slice(7) : null) || searchParams?.get("key")
  if (!provided || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  return diff === 0
}
