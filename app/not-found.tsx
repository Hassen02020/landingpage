import type { Metadata } from "next"
import { NotFoundActions } from "./components/NotFoundActions"

// Page de secours globale : rendue avec le statut HTTP 404 (jamais 200) pour toute adresse inexistante.
// Les vraies erreurs serveur ne passent pas ici : elles gardent leur propre page d'erreur.
export const metadata: Metadata = { title: "Page introuvable — Easy2Book", robots: { index: false, follow: true } }

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-4 py-16">
      <div className="max-w-lg w-full rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-sm font-bold text-violet-700">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-black text-gray-900">Cette page n&apos;existe pas ou plus</h1>
        <p className="mt-3 text-gray-600">
          Le lien a peut-être changé. Retrouvez nos voyages organisés, la Omra et les promos hôtels depuis l&apos;accueil, ou écrivez-nous : nous vous répondons sur WhatsApp.
        </p>
        <NotFoundActions />
      </div>
    </main>
  )
}
