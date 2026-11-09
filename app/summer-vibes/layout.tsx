import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config"
import Script from "next/script"
import { FAQ_ITEMS } from "./data/faq"

export const metadata: Metadata = {
  title: "Easy2Book | Promos du mois — Hôtels Tunisie, offres exclusives",
  description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Promos hôtels en Tunisie : réduction et prix par personne et par nuit, devis gratuit sur WhatsApp.",
  alternates: {
    canonical: `${SITE_URL}/summer-vibes`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "Easy2Book | Promos du mois — Hôtels Tunisie, offres exclusives",
    description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7.",
    type: "website",
    locale: "fr_FR",
    url: `${SITE_URL}/summer-vibes`,
    siteName: "Easy2Book",
    images: [
      {
        url: `${SITE_URL}/og-easy2book.jpg`,
        width: 1200,
        height: 630,
        alt: "Easy2Book — Promos du mois",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy2Book | Promos du mois — Hôtels Tunisie, offres exclusives",
    description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7.",
    images: [`${SITE_URL}/og-easy2book.jpg`],
  },
}

const jsonLdTravelAgency = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "name": "Easy2Book",
  "description": "Centrale de réservation d'hôtels en Tunisie. Hôtels, voyages de noces, séjours famille et offres exclusives.",
  "url": `${SITE_URL}/summer-vibes`,
  "telephone": "+21698140514",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "TN",
    "addressLocality": "Tunisie"
  },
  "areaServed": ["Hammamet", "Sousse", "Monastir", "Djerba", "Mahdia", "Tabarka"],
  "priceRange": "100-500 TND"
}

const jsonLdFAQPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.a
    }
  }))
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Script
        id="json-ld-travel-agency"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTravelAgency) }}
      />
      <Script
        id="json-ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFAQPage) }}
      />
      {children}
    </>
  )
}
