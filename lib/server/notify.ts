// Notification de l'équipe à chaque nouveau lead : e-mail (Resend) et/ou webhook
// (Make, n8n, WhatsApp Business…). Ne lève jamais d'erreur : la capture du lead prime.
import { hmacSha256 } from "./hash"
import { SITE_URL, PRODUCTS, type Product } from "../config"

export interface NewLeadNotice {
  id: string | null
  ref: string
  product: Product
  offer?: string | null
  firstName: string
  phone: string
  source: string
  channel?: string | null
  utmCampaign?: string | null
}

export function notifyConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_TO) || process.env.NOTIFY_WEBHOOK_URL)
}

export async function notifyNewLead(n: NewLeadNotice): Promise<{ email: boolean | null; webhook: boolean | null }> {
  const link = n.id ? `${SITE_URL.replace(/\/$/, "")}/admin/leads/${n.id}` : `${SITE_URL.replace(/\/$/, "")}/admin`
  const lines = [
    `Nouveau lead ${n.ref} — ${PRODUCTS[n.product]}${n.offer ? ` : ${n.offer}` : ""}`,
    `Prospect : ${n.firstName} — +${n.phone}`,
    `Source : ${n.source}${n.channel ? ` / ${n.channel}` : ""}${n.utmCampaign ? ` (campagne ${n.utmCampaign})` : ""}`,
    `Fiche : ${link}`,
  ]
  const result: { email: boolean | null; webhook: boolean | null } = { email: null, webhook: null }

  const apiKey = process.env.RESEND_API_KEY
  const to = (process.env.NOTIFY_EMAIL_TO || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (apiKey && to.length) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.NOTIFY_EMAIL_FROM || "Easy2Book Leads <onboarding@resend.dev>",
          to,
          subject: `Nouveau lead ${n.ref} — ${PRODUCTS[n.product]}`,
          text: lines.join("\n"),
        }),
        cache: "no-store",
      })
      result.email = res.ok
      if (!res.ok) console.error("[notify] e-mail refusé", res.status)
    } catch {
      result.email = false
      console.error("[notify] e-mail injoignable")
    }
  }

  const hook = process.env.NOTIFY_WEBHOOK_URL
  if (hook) {
    const body = JSON.stringify({ type: "lead.created", text: lines.join("\n"), lead: { ...n, link } })
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (process.env.NOTIFY_WEBHOOK_SECRET) headers["X-E2B-Signature"] = hmacSha256(process.env.NOTIFY_WEBHOOK_SECRET, body)
    try {
      const res = await fetch(hook, { method: "POST", headers, body, cache: "no-store" })
      result.webhook = res.ok
      if (!res.ok) console.error("[notify] webhook refusé", res.status)
    } catch {
      result.webhook = false
      console.error("[notify] webhook injoignable")
    }
  }
  return result
}
