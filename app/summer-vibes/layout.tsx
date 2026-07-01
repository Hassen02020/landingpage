import type { Metadata } from "next"
import Script from "next/script"

export const metadata: Metadata = {
  title: "Easy2Book | Hôtels Tunisie Été 2026 – Offres Exclusives",
  description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7 pour vos vacances en Tunisie.",
  openGraph: {
    title: "Easy2Book | Hôtels Tunisie Été 2026 – Offres Exclusives",
    description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7.",
    type: "website",
    locale: "fr_FR",
    url: "https://landingpage-easy2book.vercel.app/summer-vibes",
    siteName: "Easy2Book",
    images: [
      {
        url: "https://landingpage-easy2book.vercel.app/hero-bg.jpg",
        width: 1200,
        height: 630,
        alt: "Easy2Book Summer Vibes 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy2Book | Hôtels Tunisie Été 2026 – Offres Exclusives",
    description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7.",
    images: ["https://landingpage-easy2book.vercel.app/hero-bg.jpg"],
  },
  other: {
    "fb:page_id": "Easy2Bookplateforme",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "name": "Easy2Book",
  "description": "Centrale de réservation d'hôtels en Tunisie. Hôtels, voyages de noces, séjours famille et offres exclusives.",
  "url": "https://landingpage-easy2book.vercel.app/summer-vibes",
  "telephone": "+21698140514",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "TN",
    "addressLocality": "Tunisie"
  },
  "areaServed": ["Hammamet", "Sousse", "Monastir", "Djerba", "Mahdia", "Tabarka"],
  "priceRange": "100-500 TND",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "500"
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
