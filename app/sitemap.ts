import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { BLOG_POSTS } from "@/lib/blog-data"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://petora.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/dogs`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/cats`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/deals`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/brands`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/blog`, changeFrequency: "weekly", priority: 0.6 },
    ...BLOG_POSTS.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ]

  try {
    const supabase = await createClient()
    const [{ data: products }, { data: categories }, { data: brands }] = await Promise.all([
      supabase.from("products").select("slug, updated_at").eq("status", "active").limit(5000),
      supabase.from("categories").select("slug").eq("is_active", true),
      supabase.from("brands").select("slug").eq("is_active", true),
    ])

    const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    }))
    const categoryRoutes: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
      url: `${siteUrl}/category/${c.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    }))
    const brandRoutes: MetadataRoute.Sitemap = (brands ?? []).map((b) => ({
      url: `${siteUrl}/brands/${b.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }))

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...brandRoutes]
  } catch (err) {
    console.error("sitemap:", err instanceof Error ? err.message : err)
    return staticRoutes
  }
}
