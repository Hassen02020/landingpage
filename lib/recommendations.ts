import { createClient } from "@/lib/supabase/server"
import type { ProductCardData } from "@/lib/types"
import type { Pet } from "@/lib/data/pets"

// Simple rule-based recommendation engine for the MVP (spec: no AI yet).
// Swap the body of this function for a model-backed call later without
// touching callers — they only depend on this signature.
export async function getRecommendationsForPet(pet: Pet, limit = 8): Promise<ProductCardData[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from("products")
      .select(
        "id, slug, name, avg_rating, review_count, pet_type, brands(name), product_variants(id, price_cents, compare_at_price_cents, is_default), product_images(url, sort_order)"
      )
      .eq("status", "active")
      .in("pet_type", [pet.species, "both"])

    if (pet.lifeStage) {
      query = query.in("life_stage", [pet.lifeStage, "all"])
    }

    const { data, error } = await query.order("avg_rating", { ascending: false }).limit(50)
    if (error || !data) return []

    const allergies = pet.allergies.map((a) => a.toLowerCase())

    const scored = (data as any[])
      .filter((p) => {
        if (allergies.length === 0) return true
        const haystack = `${p.name}`.toLowerCase()
        return !allergies.some((a) => haystack.includes(a))
      })
      .map((p) => {
        const variant = p.product_variants.find((v: any) => v.is_default) ?? p.product_variants[0]
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
          priceCents: variant?.price_cents ?? 0,
          compareAtPriceCents: variant?.compare_at_price_cents ?? null,
          petType: p.pet_type,
          defaultVariantId: variant?.id ?? null,
        } satisfies ProductCardData
      })

    // Budget filter applied last so a narrow price band never empties the list.
    const budgetFiltered = filterByBudget(scored, pet.budget)
    return (budgetFiltered.length > 0 ? budgetFiltered : scored).slice(0, limit)
  } catch (err) {
    console.error("getRecommendationsForPet:", err instanceof Error ? err.message : err)
    return []
  }
}

function filterByBudget(products: ProductCardData[], budget: string | null): ProductCardData[] {
  if (!budget || products.length === 0) return products
  const sorted = [...products].sort((a, b) => a.priceCents - b.priceCents)
  const third = Math.max(1, Math.ceil(sorted.length / 3))

  if (budget === "value") return sorted.slice(0, third)
  if (budget === "premium") return sorted.slice(-third)
  return sorted.slice(third, sorted.length - third || third)
}
