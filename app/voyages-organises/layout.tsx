import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Voyages Organisés 2026-2027 — Easy2Book",
  description:
    "Voyages organisés au départ de Tunis : Australie, Japon, Égypte, Jordanie, Turquie, Maroc, Chine… Départs de novembre 2026 à mai 2027, prix à partir de 1 950 TND par personne. Programme sur demande.",
  openGraph: {
    title: "Voyages Organisés 2026-2027 — Easy2Book",
    description:
      "Premium, Individuel garanti et Standard : découvrez nos départs de novembre 2026 à mai 2027 et demandez le programme sur WhatsApp.",
    url: "https://landingpage-easy2book.vercel.app/voyages-organises",
    siteName: "Easy2Book",
    images: ["https://landingpage-easy2book.vercel.app/logo.png"],
    locale: "fr_TN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voyages Organisés 2026-2027 — Easy2Book",
    description: "Australie, Japon, Égypte, Jordanie, Turquie, Maroc… départs de novembre 2026 à mai 2027. Programme sur demande.",
  },
}

export default function VoyagesOrganisesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
