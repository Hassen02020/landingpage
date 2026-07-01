import type { Metadata } from "next"
import Script from "next/script"
import { FAQ_ITEMS } from "./data/faq"

export const metadata: Metadata = {
  title: "Easy2Book | Hôtels Tunisie Été 2026 – Offres Exclusives",
  description: "Réservez hôtels, voyages de noces et vacances famille avec Easy2Book. Meilleurs prix garantis, paiement flexible et assistance 24/7 pour vos vacances en Tunisie.",
  alternates: {
    canonical: "https://landingpage-easy2book.vercel.app/summer-vibes",
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

const jsonLdTravelAgency = {
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
