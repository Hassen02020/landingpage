import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { dbConfigured } from "@/lib/server/db"
import { publicCategory } from "@/lib/server/catalog"
import { SITE_URL } from "@/lib/config"
import { CategoryView } from "./CategoryView"

// Page publique d'une catégorie créée dans /admin/catalogue (bannières, SEO, offres, formulaire).
export const revalidate = 60

async function load(slug: string) {
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
  const data = await load(params.slug)
  if (!data) notFound()
  return <CategoryView category={data.category} offers={data.offers} />
}
