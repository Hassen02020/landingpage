// Exécuteur de la publication programmée (Créateur). PROTÉGÉ PAR SECRET et ÉCHEC FERMÉ :
//   • sans variable CRON_SECRET (16 caractères minimum) → 503, rien n'est exécuté ;
//   • sans l'en-tête « Authorization: Bearer <secret> » exact → 401, rien n'est exécuté.
// AUCUNE tâche planifiée n'est déclarée dans le dépôt (vercel.json) : l'activer est une décision du propriétaire (variable CRON_SECRET + cron Vercel).
// Le bouton « Appliquer les programmations échues » du tableau de bord fait la même chose, à la demande, pour un administrateur connecté.
import { NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "node:crypto"
import { withPublicOrg } from "@/lib/server/db"
import { runDueSchedules } from "@/lib/server/page-schedule"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const digest = (s: string) => createHash("sha256").update(s).digest()

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? ""
  if (secret.length < 16) return NextResponse.json({ error: "Tâche planifiée non configurée." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? ""
  if (!timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  try {
    // organisation de la plateforme uniquement (le Créateur lui est réservé) ; seuls des compteurs sont renvoyés
    const r = await withPublicOrg(() => runDueSchedules())
    return NextResponse.json({ ok: true, available: r.available, published: r.published, unpublished: r.unpublished, cleared: r.cleared, blocked: r.blocked.length }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    console.error("[cron] publication programmée", e instanceof Error ? e.message : "erreur")
    return NextResponse.json({ error: "Exécution impossible." }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
