// Relance des conversions Meta échouées (journal, migration 0028). PROTÉGÉ PAR SECRET et ÉCHEC FERMÉ, comme la publication programmée :
//   • sans CRON_SECRET (16 caractères minimum) → 503, rien n'est exécuté ;
//   • sans « Authorization: Bearer <secret> » exact → 401, rien n'est exécuté.
// Déclenchée par le cron Vercel de vercel.json (une fois par jour, limite de l'offre Hobby) ; le bouton « Relancer maintenant » de la page
// « Qualité des données » fait la même chose à la demande. Seuls des compteurs sont renvoyés (aucune donnée personnelle).
import { NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "node:crypto"
import { withPublicOrg } from "@/lib/server/db"
import { retryConversions } from "@/lib/server/conversions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const digest = (s: string) => createHash("sha256").update(s).digest()
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? ""
  if (secret.length < 16) return NextResponse.json({ error: "Tâche planifiée non configurée." }, { status: 503, headers: NO_STORE })
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? ""
  if (!timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: NO_STORE })
  try {
    // organisation de la plateforme (Easy2Book) : les conversions sont envoyées à SON pixel
    const r = await withPublicOrg(() => retryConversions())
    return NextResponse.json({ ok: true, ...r }, { headers: NO_STORE })
  } catch (e) {
    console.error("[cron] relance des conversions", e instanceof Error ? e.message : "erreur")
    return NextResponse.json({ error: "Exécution impossible." }, { status: 500, headers: NO_STORE })
  }
}
