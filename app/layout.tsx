import type { Metadata } from "next"
import "./globals.css"
import { AttributionTracker } from "./components/AttributionTracker"
import { TrackingConsent } from "./components/TrackingConsent"
import { SITE_URL } from "@/lib/config"

export const metadata: Metadata = {
  alternates: { canonical: "./" },
  metadataBase: new URL(SITE_URL),
  title: "Easy2Book — Voyages organisés, Omra & Promos hôtels",
  description:
    "Easy2Book, votre agence de voyage en Tunisie : voyages organisés (Turquie, Égypte, Bali…), Omra et promos hôtels en Tunisie. Réservation rapide sur WhatsApp.",
  openGraph: {
    title: "Easy2Book — Voyages organisés, Omra & Promos hôtels",
    description: "Voyages organisés, Omra et meilleures offres hôtelières en Tunisie. Réservez sur WhatsApp.",
    type: "website",
    url: SITE_URL,
    siteName: "Easy2Book",
    images: [
      {
        url: "/og-easy2book.jpg",
        width: 1200,
        height: 630,
        alt: "Easy2Book",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {/* Pixels Meta / TikTok : chargés uniquement après consentement */}
        <TrackingConsent />
        <AttributionTracker />
        {children}
      </body>
    </html>
  )
}
