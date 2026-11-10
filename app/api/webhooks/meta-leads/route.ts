// Webhook Meta Lead Ads (Facebook, Instagram). Inerte (404) tant que META_APP_SECRET / META_LEADS_VERIFY_TOKEN ne sont pas définis.
// Pas de contrôle d'origine navigateur ici : l'authentification est la SIGNATURE de Meta (voir lib/server/meta-leads.ts).
import { handleMetaLeadsGet, handleMetaLeadsPost, type WebhookResult } from "@/lib/server/meta-leads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const respond = (r: WebhookResult) =>
  new Response(r.body, { status: r.status, headers: r.body ? { "Content-Type": r.contentType ?? "text/plain", "Cache-Control": "no-store" } : { "Cache-Control": "no-store" } })

export async function GET(request: Request) {
  return respond(handleMetaLeadsGet(new URL(request.url).searchParams))
}

export async function POST(request: Request) {
  const raw = await request.text()
  return respond(await handleMetaLeadsPost(raw, request.headers.get("x-hub-signature-256")))
}
