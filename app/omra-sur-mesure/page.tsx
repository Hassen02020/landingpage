import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config"
import { LandingView } from "@/app/p/[slug]/LandingView"
import { CATEGORY, DESIGN, POSTER, SLUG } from "./content"

// « Omra à la carte » : même rendu que les pages Omra du Créateur (/p/omra-ramadan-complet), contenu fixe dans le code (aucune lecture en base).
// La page est « sur devis » : aucune offre ni prix. Le formulaire est celui du CRM (consentement, anti-doublon, attribution, WhatsApp).
export const metadata: Metadata = {
  title: CATEGORY.seo_title ?? undefined,
  description: CATEGORY.seo_description ?? undefined,
  alternates: { canonical: `${SITE_URL}/${SLUG}` },
  openGraph: {
    title: CATEGORY.seo_title ?? undefined,
    description: CATEGORY.seo_description ?? undefined,
    url: `${SITE_URL}/${SLUG}`,
    siteName: "Easy2Book",
    type: "website",
    locale: "ar_TN",
    images: [{ url: `${SITE_URL}${POSTER}`, width: 720, height: 1280, alt: CATEGORY.name }],
  },
}

export default function OmraSurMesurePage() {
  return <LandingView category={CATEGORY} offers={[]} design={DESIGN} />
}
