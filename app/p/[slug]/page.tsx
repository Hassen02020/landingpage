import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { dbConfigured, withPublicOrg } from "@/lib/server/db"
import { lookupPublicCategory } from "@/lib/server/catalog"
import { fallbackTarget, queryString } from "@/lib/fallback"
import { unavailable } from "@/lib/server/public-errors"
import { SITE_URL } from "@/lib/config"
import { LandingView } from "./LandingView"

// Pages publiées par le Créateur de Landing Pages. Même règles que /c/<adresse> : introuvable → secours (query conservée) ; panne ou base absente → HTTP 500.
// Rendu à chaque requête (aucune page statique à rafraîchir).
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = dbConfigured() ? await withPublicOrg(() => lookupPublicCategory(params.slug)) : null
  if (!r || r.status !== "found") return { title: "Easy2Book", robots: { index: false, follow: false } }
  const c = r.data.category
  const image = c.banner_desktop || c.banner_mobile
  return {
    title: c.seo_title || `${c.name} — Easy2Book`,
    description: c.seo_description || c.headline || undefined,
    robots: { index: false, follow: true }, // pages publicitaires : hors des moteurs de recherche (comme /c/)
    openGraph: { title: c.seo_title || c.name, description: c.seo_description || c.headline || undefined, url: `${SITE_URL}/p/${c.slug}`, images: image ? [{ url: image.startsWith("/") ? `${SITE_URL}${image}` : image }] : undefined },
  }
}

export default async function LandingPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  // une seule adresse officielle par contenu : omra-2027 est servie par /omra (paramètres de campagne conservés)
  if (params.slug === "omra-2027") redirect(`/omra${queryString(searchParams)}`)
  // panne ou base non configurée = erreur de SERVICE (HTTP 500) : jamais un 404, jamais une redirection
  if (!dbConfigured()) throw unavailable("/p/[slug]", "db_not_configured", params.slug)
  const found = await withPublicOrg(() => lookupPublicCategory(params.slug))
  if (found.status === "error") throw unavailable("/p/[slug]", "db_error", params.slug)
  // secours UNIQUEMENT pour un « introuvable » confirmé (page masquée ou inconnue) : le visiteur d'une publicité n'arrive pas sur une erreur
  if (found.status === "not_found") redirect(fallbackTarget(`/p/${params.slug}`, searchParams) ?? "/voyages-organises")
  return <LandingView category={found.data.category} offers={found.data.offers} />
}
