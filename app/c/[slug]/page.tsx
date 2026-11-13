import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { dbConfigured, withPublicOrg } from "@/lib/server/db"
import { lookupPublicCategory, publicCategory } from "@/lib/server/catalog"
import { fallbackTarget } from "@/lib/fallback"
import { unavailable } from "@/lib/server/public-errors"
import { SITE_URL } from "@/lib/config"
import { CategoryView } from "./CategoryView"

// Page publique d'une catégorie créée dans /admin/catalogue (bannières, SEO, offres, formulaire).
// Page publique : lecture du catalogue dans le contexte explicite de l'organisation du site public.
const load = (slug: string) => withPublicOrg(() => loadUnscoped(slug))

export const revalidate = 60

async function loadUnscoped(slug: string) {
  if (!dbConfigured()) return null
  try {
    return await publicCategory(slug)
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await load(params.slug)
  if (!data) return { title: "Easy2Book" }
  const c = data.category
  const image = c.banner_desktop || c.banner_mobile
  return {
    title: c.seo_title || `${c.name} — Easy2Book`,
    description: c.seo_description || c.headline || undefined,
    alternates: { canonical: `${SITE_URL}/c/${c.slug}` },
    openGraph: {
      title: c.seo_title || c.name,
      description: c.seo_description || c.headline || undefined,
      url: `${SITE_URL}/c/${c.slug}`,
      images: image ? [{ url: image.startsWith("/") ? `${SITE_URL}${image}` : image }] : undefined,
    },
  }
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  // une seule adresse officielle par contenu : omra-2027 est servie par /omra (les paramètres de campagne sont conservés)
  if (params.slug === "omra-2027") {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x)
    redirect(`/omra${qs.toString() ? `?${qs}` : ""}`)
  }
  // panne ou base non configurée = erreur de SERVICE (HTTP 500, message app/error.tsx) : jamais un 404, jamais une redirection
  if (!dbConfigured()) throw unavailable("/c/[slug]", "db_not_configured", params.slug)
  const found = await withPublicOrg(() => lookupPublicCategory(params.slug))
  if (found.status === "error") throw unavailable("/c/[slug]", "db_error", params.slug)
  // secours UNIQUEMENT pour un « introuvable » confirmé par la base
  if (found.status === "not_found") redirect(fallbackTarget(`/c/${params.slug}`, searchParams) ?? "/voyages-organises")
  return <CategoryView category={found.data.category} offers={found.data.offers} />
}
