// Identifiants PUBLICS des pixels (Meta, TikTok) pour le navigateur, après consentement.
// Réglés dans /admin/integrations (à défaut : variables Vercel). Aucun jeton n'est renvoyé.
import { NextResponse } from "next/server"
import { publicPixelIds } from "@/lib/server/integrations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const ids = await publicPixelIds()
  return NextResponse.json(ids, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
  })
}
