// Identifiants PUBLICS des pixels (Meta, TikTok) pour le navigateur, après consentement.
// Réglés dans /admin/integrations (à défaut : variables Vercel). Aucun jeton n'est renvoyé.
import { NextResponse } from "next/server"
import { publicPixelIds } from "@/lib/server/integrations"
import { withPublicOrg } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handleGET() {
  const ids = await publicPixelIds()
  return NextResponse.json(ids, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
  })
}

// Réglages publicitaires du site public (organisation n°1) : contexte explicite, passant avant toute session.
export const GET = () => withPublicOrg(() => handleGET())
