// Webhook WhatsApp (API Cloud de Meta). Inerte (404) tant que WHATSAPP_VERIFY_TOKEN et un secret d'application ne sont pas définis.
// Pas de contrôle d'origine navigateur ici : l'authentification est la SIGNATURE de Meta (voir lib/server/whatsapp-inbound.ts).
import { handleWhatsAppGet, handleWhatsAppPost } from "@/lib/server/whatsapp-inbound"
import type { WebhookResult } from "@/lib/server/meta-leads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const respond = (r: WebhookResult) =>
  new Response(r.body, { status: r.status, headers: r.body ? { "Content-Type": r.contentType ?? "text/plain", "Cache-Control": "no-store" } : { "Cache-Control": "no-store" } })

export async function GET(request: Request) {
  return respond(handleWhatsAppGet(new URL(request.url).searchParams))
}

export async function POST(request: Request) {
  const raw = await request.text()
  return respond(await handleWhatsAppPost(raw, request.headers.get("x-hub-signature-256")))
}
