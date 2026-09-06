import { createClient } from "@/lib/supabase/server"
import type { BrandCardData, CategoryCardData, ProductCardData, PromotionData } from "@/lib/types"

// Wraps every catalog read so a Supabase outage or missing config degrades
// the storefront to empty sections instead of a hard 500.
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`${label}:`, err instanceof Error ? err.message : err)
    return fallback
  }
}

export async function getActivePromotions(placement = "homepage_banner"): Promise<PromotionData[]> {
  return safe("getActivePromotions", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("promotions")
      .select("id, title, subtitle, cta_label, cta_href, badge_text")
      .eq("placement", placement)
      .eq("is_active", true)
      .order("sort_order")

    if (error) throw error

    return (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      ctaLabel: p.cta_label,
      ctaHref: p.cta_href,
      badgeText: p.badge_text,
    }))
  }, [])
}

export async function getTopCategories(limit = 8): Promise<CategoryCardData[]> {
  return safe("getTopCategories", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("categories")
      .select("id, slug, name, image_url")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order")
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name, imageUrl: c.image_url }))
  }, [])
}

export async function getBrands(limit = 12): Promise<BrandCardData[]> {
  return safe("getBrands", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("brands")
      .select("id, slug, name, logo_url")
      .eq("is_active", true)
      .order("sort_order")
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((b) => ({ id: b.id, slug: b.slug, name: b.name, logoUrl: b.logo_url }))
  }, [])
}

type ProductRow = {
  id: string
  slug: string
  name: string
  avg_rating: number
  review_count: number
  pet_type: "dog" | "cat" | "both"
  brands: { name: string } | { name: string }[] | null
  product_variants: { id: string; price_cents: number; compare_at_price_cents: number | null; is_default: boolean }[]
  product_images: { url: string; sort_order: number }[]
}

function mapProductRow(p: ProductRow): ProductCardData {
  const variant =
    p.product_variants.find((v) => v.is_default) ??
    p.product_variants[0] ??
    { id: null, price_cents: 0, compare_at_price_cents: null }
  const image = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: brand?.name ?? null,
    imageUrl: image?.url ?? null,
    rating: p.avg_rating,
    reviewCount: p.review_count,
    priceCents: variant.price_cents,
    compareAtPriceCents: variant.compare_at_price_cents,
    petType: p.pet_type,
    defaultVariantId: variant.id,
  }
}

const PRODUCT_CARD_SELECT =
  "id, slug, name, avg_rating, review_count, pet_type, brands(name), product_variants(id, price_cents, compare_at_price_cents, is_default), product_images(url, sort_order)"

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  return safe("getBestSellers", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .contains("tags", ["best-seller"])
      .order("review_count", { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data as unknown as ProductRow[]).map(mapProductRow)
  }, [])
}

export async function getProductsByCategory(categorySlug: string, limit = 24): Promise<ProductCardData[]> {
  return safe("getProductsByCategory", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(`${PRODUCT_CARD_SELECT}, categories!inner(slug)`)
      .eq("status", "active")
      .eq("categories.slug", categorySlug)
      .limit(limit)

    if (error) throw error

    return (data as unknown as ProductRow[]).map(mapProductRow)
  }, [])
}

export async function getProductsByPet(petType: "dog" | "cat", limit = 24): Promise<ProductCardData[]> {
  return safe("getProductsByPet", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .in("pet_type", [petType, "both"])
      .limit(limit)

    if (error) throw error

    return (data as unknown as ProductRow[]).map(mapProductRow)
  }, [])
}

export async function searchProducts(query: string, limit = 24): Promise<ProductCardData[]> {
  return safe("searchProducts", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .ilike("name", `%${query}%`)
      .limit(limit)

    if (error) throw error

    return (data as unknown as ProductRow[]).map(mapProductRow)
  }, [])
}

export async function getDeals(limit = 24): Promise<ProductCardData[]> {
  return safe("getDeals", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .limit(200)

    if (error) throw error

    return (data as unknown as ProductRow[])
      .map(mapProductRow)
      .filter((p) => p.compareAtPriceCents != null && p.compareAtPriceCents > p.priceCents)
      .slice(0, limit)
  }, [])
}

export async function getCategoryBySlug(slug: string): Promise<CategoryCardData | null> {
  return safe("getCategoryBySlug", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("categories")
      .select("id, slug, name, image_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (error || !data) return null
    return { id: data.id, slug: data.slug, name: data.name, imageUrl: data.image_url }
  }, null)
}

export async function getBrandBySlug(slug: string): Promise<BrandCardData | null> {
  return safe("getBrandBySlug", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("brands")
      .select("id, slug, name, logo_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (error || !data) return null
    return { id: data.id, slug: data.slug, name: data.name, logoUrl: data.logo_url }
  }, null)
}

export async function getProductsByBrand(brandSlug: string, limit = 24): Promise<ProductCardData[]> {
  return safe("getProductsByBrand", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(`${PRODUCT_CARD_SELECT}, brands!inner(slug)`)
      .eq("status", "active")
      .eq("brands.slug", brandSlug)
      .limit(limit)

    if (error) throw error

    return (data as unknown as ProductRow[]).map(mapProductRow)
  }, [])
}
