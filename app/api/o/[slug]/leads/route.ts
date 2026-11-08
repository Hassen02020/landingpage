import { NextRequest, NextResponse } from "next/server"
import { runWithOrg } from "@/lib/server/db"
import { handleLeadPost } from "@/lib/server/lead-intake"
import { loadFormConfig, loadPublicOrg } from "@/lib/server/org-public"

export const runtime = "nodejs"

/**
 * POST /api/o/<identifiant>/leads — formulaire public d'une ENTREPRISE cliente.
 * L'entreprise vient de l'identifiant PUBLIC de l'adresse (entreprise active uniquement) et fixe le contexte d'organisation :
 * le lead est enregistré chez elle, jamais chez Easy2Book. Pas de numéro WhatsApp d'Easy2Book, pas de notification d'équipe d'Easy2Book.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const org = await loadPublicOrg(params.slug)
  // Easy2Book garde ses propres pages et son propre flux (/api/leads) : ce point d'entrée est réservé aux entreprises clientes
  if (!org || org.slug === "easy2book") return NextResponse.json({ error: "Page introuvable" }, { status: 404 })
  return runWithOrg(org.id, async () => handleLeadPost(request, { platform: false, orgSlug: org.slug, formConfig: await loadFormConfig() }))
}
