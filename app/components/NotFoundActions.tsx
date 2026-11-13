"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { trackingQuery } from "@/lib/fallback"
import { buildWhatsAppUrl } from "@/lib/tracking"

/** Boutons de la page 404 : retour à l'accueil (en conservant la campagne éventuelle) et WhatsApp. */
export function NotFoundActions() {
  const [qs, setQs] = useState("")
  useEffect(() => {
    setQs(trackingQuery(new URLSearchParams(window.location.search)))
  }, [])
  const wa = buildWhatsAppUrl("Bonjour Easy2Book, je cherchais une offre mais la page est introuvable. Pouvez-vous m'aider ?")
  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
      <Link href={`/${qs}`} className="inline-flex items-center justify-center rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold px-6 py-3">
        Retour à l&apos;accueil
      </Link>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3">
        Écrire sur WhatsApp
      </a>
    </div>
  )
}
