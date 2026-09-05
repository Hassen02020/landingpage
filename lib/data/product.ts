import { createClient } from "@/lib/supabase/server"
import type { ProductDetailData, ProductCardData, ReviewData } from "@/lib/types"

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`${label}:`, err instanceof Error ? err.message : err)
    return fallback
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  return safe("getProductBySlug", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, slug, name, short_description, description, ingredients, feeding_instructions,
         seo_description, pet_type, life_stage, avg_rating, review_count, is_subscribable,
         brands(name, slug),
         categories(slug),
         product_images(url, alt, sort_order),
         product_variants(id, sku, size, flavor, price_cents, compare_at_price_cents, is_default, sort_order, inventory(quantity_available))`
      )
      .eq("slug", slug)
      .eq("status", "active")
      .single()

    if (error || !data) return null

    const brand = Array.isArray(data.brands) ? data.brands[0] : data.brands
    const category = Array.isArray(data.categories) ? data.categories[0] : data.categories

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      brandName: brand?.name ?? null,
      brandSlug: brand?.slug ?? null,
      categorySlug: category?.slug ?? null,
      shortDescription: data.short_description,
      description: data.description,
      ingredients: data.ingredients,
      feedingInstructions: data.feeding_instructions,
      seoDescription: data.seo_description,
      petType: data.pet_type,
      lifeStage: data.life_stage,
      rating: data.avg_rating,
      reviewCount: data.review_count,
      isSubscribable: data.is_subscribable,
      images: [...data.product_images]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({ url: img.url, alt: img.alt })),
      variants: (data.product_variants as any[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          flavor: v.flavor,
          priceCents: v.price_cents,
          compareAtPriceCents: v.compare_at_price_cents,
          inStock: ((Array.isArray(v.inventory) ? v.inventory[0]?.quantity_available : v.inventory?.quantity_available) ?? 0) > 0,
        })),
    }
  }, null)
}

export async function getRelatedProducts(categorySlug: string | null, excludeProductId: string, limit = 4): Promise<ProductCardData[]> {
  return safe("getRelatedProducts", async () => {
    if (!categorySlug) return []
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, slug, name, avg_rating, review_count, pet_type, brands(name), product_variants(id, price_cents, compare_at_price_cents, is_default), product_images(url, sort_order), categories!inner(slug)"
      )
      .eq("status", "active")
      .eq("categories.slug", categorySlug)
      .neq("id", excludeProductId)
      .limit(limit)

    if (error) throw error

    return (data as any[]).map((p) => {
      const variant = p.product_variants.find((v: any) => v.is_default) ?? p.product_variants[0] ?? { id: null, price_cents: 0, compare_at_price_cents: null }
      const image = [...p.product_images].sort((a: any, b: any) => a.sort_order - b.sort_order)[0]
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
        defaultVariantId: variant.id,
        petType: p.pet_type,
      }
    })
  }, [])
}

export async function getApprovedReviews(productId: string, limit = 10): Promise<ReviewData[]> {
  return safe("getApprovedReviews", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, title, body, is_verified_purchase, created_at, profiles(full_name)")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data as any[]).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      isVerifiedPurchase: r.is_verified_purchase,
      createdAt: r.created_at,
      authorName: (Array.isArray(r.profiles) ? r.profiles[0]?.full_name : r.profiles?.full_name) ?? "PETORA Customer",
    }))
  }, [])
}
