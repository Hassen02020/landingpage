import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Voyages Organisés 2026 — Easy2Book",
  description:
    "Voyages organisés Turquie, Malaisie & Bali, Égypte, Maroc — Été & Automne 2026. Vols + hôtels + visites inclus. Réservez avec Easy2Book.",
  openGraph: {
    title: "Voyages Organisés 2026 — Easy2Book",
    description:
      "Istanbul, Kuala Lumpur & Bali, Sharm El Sheikh, Marrakech... Découvrez nos voyages organisés tout inclus pour l'été 2026.",
    url: "https://landingpage-easy2book.vercel.app/voyages-organises",
    siteName: "Easy2Book",
    images: ["https://landingpage-easy2book.vercel.app/logo.png"],
    locale: "fr_TN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voyages Organisés 2026 — Easy2Book",
    description: "Turquie, Malaisie & Bali, Égypte, Maroc — voyages tout inclus. Réservez maintenant avec Easy2Book.",
  },
}

export default function VoyagesOrganisesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
