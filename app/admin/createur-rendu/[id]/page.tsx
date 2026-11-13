import { notFound } from "next/navigation"
import { builderAccess, loadBuilderPage, toPublicOffers } from "@/lib/server/page-builder"
import { CategoryView } from "@/app/c/[slug]/CategoryView"

// Rendu RÉEL de la page publique (même composant que /c/<adresse>) pour l'aperçu du Créateur, même si la page est masquée.
// Réservé à l'équipe autorisée (contrôle serveur) ; boutons et formulaire désactivés : un aperçu n'envoie jamais de prospect ni d'événement.
export const dynamic = "force-dynamic"

export default async function RenduPage({ params }: { params: { id: string } }) {
  const access = await builderAccess()
  if (!access.ok) return <p className="p-6 text-gray-700">{access.message}</p>
  const page = await loadBuilderPage(params.id)
  if (!page) notFound()
  return <CategoryView category={page.category} offers={toPublicOffers(page.offers)} preview />
}
