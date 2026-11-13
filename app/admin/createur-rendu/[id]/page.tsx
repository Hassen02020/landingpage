import { notFound } from "next/navigation"
import { builderAccess, loadBuilderPage, toPublicOffers } from "@/lib/server/page-builder"
import { loadDesign } from "@/lib/server/page-design"
import { LandingView } from "@/app/p/[slug]/LandingView"

// Rendu RÉEL de la page publique (même composant que /p/<adresse>) pour l'aperçu du Créateur, même si la page est masquée.
// Réservé à l'équipe autorisée (contrôle serveur) ; boutons et formulaire désactivés : un aperçu n'envoie jamais de prospect ni d'événement.
export const dynamic = "force-dynamic"

export default async function RenduPage({ params }: { params: { id: string } }) {
  const access = await builderAccess()
  if (!access.ok) return <p className="p-6 text-gray-700">{access.message}</p>
  const page = await loadBuilderPage(params.id)
  if (!page) notFound()
  const d = await loadDesign(page.category.id, page.category.product).catch(() => null)
  return <LandingView category={page.category} offers={toPublicOffers(page.offers)} design={d?.available && d.stored ? d.design : null} preview />
}
