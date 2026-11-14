import { NextRequest, NextResponse } from "next/server"
import { withPublicOrg } from "@/lib/server/db"
import { clientIp } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited } from "@/lib/server/guard"
import { listPublished, submitReview } from "@/lib/server/reviews"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200, cache = "no-store") => NextResponse.json(body, { status, headers: { "Cache-Control": cache } })

/** GET /api/reviews?page=omra — avis PUBLIÉS (validés par l'équipe) et leur moyenne. Rien d'autre n'est jamais renvoyé.
 *  Cache : 60 s au maximum sur le réseau de diffusion (s-maxage), jamais dans le navigateur (un avis retiré ne doit pas rester affiché). */
export async function GET(request: NextRequest) {
  const page = new URL(request.url).searchParams.get("page") ?? ""
  const data = await withPublicOrg(() => listPublished(page))
  return json(data, 200, "public, max-age=0, s-maxage=60, must-revalidate")
}

/** POST /api/reviews — dépôt d'un avis (statut « en attente » : jamais publié automatiquement). */
export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.headers)) return json({ ok: false, error: "Origine refusée." }, 403)
  const ip = clientIp(request.headers)
  // inondation : 30 envois par heure et par adresse, valides ou non (freine un robot sans gêner un visiteur qui se trompe)
  if (rateLimited(ip ? `review-try:${ip}` : undefined, 30, 60 * 60 * 1000)) return json({ ok: false, error: "Trop de tentatives. Réessayez plus tard." }, 429)
  const raw = await request.text().catch(() => "")
  if (raw.length > 4000) return json({ ok: false, error: "Message trop long." }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("format")
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400)
  }
  // avis VALIDES acceptés : 3 par heure et par adresse, 20 par heure pour l'ensemble du site
  const allow = () => !(rateLimited(ip ? `review:${ip}` : undefined, 3, 60 * 60 * 1000) || rateLimited("review:global", 20, 60 * 60 * 1000))
  const result = await withPublicOrg(() => submitReview({ page: String(body.page ?? ""), rating: body.rating, name: body.name, comment: body.comment, consent: body.consent, lang: body.lang, website: body.website }, { allow }))
  if (result.ok) return json({ ok: true }, 201)
  if (result.reason === "invalid") return json({ ok: false, errors: result.errors }, 400)
  if (result.reason === "rate") return json({ ok: false, error: "Trop d'avis envoyés. Réessayez plus tard." }, 429)
  return json({ ok: false, error: "Service momentanément indisponible. Réessayez plus tard." }, 503)
}
