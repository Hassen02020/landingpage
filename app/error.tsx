"use client"

import Link from "next/link"
import { buildWhatsAppUrl } from "@/lib/tracking"

// Barrière d'erreur des pages publiques (panne du service de données, erreur de rendu imprévue).
// Le serveur répond HTTP 500 (jamais 404 ni redirection) ; le détail technique n'est JAMAIS affiché (il reste dans le journal serveur « DB_UNAVAILABLE »).
// LIMITE ACCEPTÉE : ce message personnalisé n'apparaît qu'après le chargement du JavaScript ; sans JavaScript, le HTML d'un statut 500 ne contient que la coquille de l'application.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const wa = buildWhatsAppUrl("Bonjour Easy2Book, la page ne se charge pas. Pouvez-vous m'aider ?")
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-4 py-16">
      <div className="max-w-lg w-full rounded-3xl bg-white p-8 text-center shadow-2xl" role="alert">
        <p className="text-sm font-bold text-violet-700">Service momentanément indisponible</p>
        <h1 className="mt-2 text-3xl font-black text-gray-900">Nous ne pouvons pas afficher cette page pour le moment</h1>
        <p className="mt-3 text-gray-600">Ce n&apos;est pas un lien cassé : notre service rencontre un problème temporaire. Réessayez dans un instant, ou écrivez-nous sur WhatsApp.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={() => reset()} className="inline-flex items-center justify-center rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold px-6 py-3">
            Réessayer
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3">
            Écrire sur WhatsApp
          </a>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-gray-300 text-gray-800 font-bold px-6 py-3">
            Accueil
          </Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-gray-400">Référence : {error.digest}</p>}
      </div>
    </main>
  )
}
