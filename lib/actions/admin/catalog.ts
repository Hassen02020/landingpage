"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

export type PromoteActionState =
  | { success: true; productId: string }
  | { success: false; error: string }

const MAX_SLUG_ATTEMPTS = 5

/**
 * Promotes one pending catalog_staging row into a real product + variant +
 * inventory row. Lands as status 'draft' — a supplier feed has no photos,
 * no description, and hasn't been reviewed for accuracy, so it's never
 * auto-published to the storefront; a tenant staffer publishes it from the
 * product editor once it's been checked, the same as any manually-created
 * product.
 */
export async function promoteStagingAction(stagingId: string): Promise<PromoteActionState> {
  const supabase = await createClient()

  const { data: staging } = await supabase
    .from("catalog_staging")
    .select("id, tenant_id, supplier_sku, name, price_cents, stock, status")
    .eq("id", stagingId)
    .single()

  if (!staging) return { success: false, error: "Staged listing not found." }
  if (staging.status !== "pending") return { success: false, error: "This listing has already been reviewed." }

  const baseSlug = slugify(staging.name) || `imported-${staging.supplier_sku.toLowerCase()}`
  let productId: string | null = null

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        tenant_id: staging.tenant_id,
        name: staging.name,
        slug,
        status: "draft",
        pet_type: "both", // supplier feeds don't classify by pet — a staffer sets this on review
        tags: ["imported"],
      })
      .select("id")
      .single()

    if (!error && product) {
      productId = product.id
      break
    }
    if (error?.code !== "23505") {
      return { success: false, error: "Could not create product." }
    }
    // 23505 = unique_violation on (tenant_id, slug) — try the next suffix.
  }

  if (!productId) return { success: false, error: "Could not find an available slug after several attempts." }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      sku: `IMP-${staging.supplier_sku}`,
      price_cents: staging.price_cents,
      is_default: true,
    })
    .select("id")
    .single()

  if (variantError || !variant) return { success: false, error: "Product created, but the variant could not be saved." }

  await supabase.from("inventory").insert({ variant_id: variant.id, quantity_available: staging.stock })
  await supabase.from("catalog_staging").update({ status: "promoted", matched_product_id: productId }).eq("id", stagingId)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from("catalog_mappings").insert({
    tenant_id: staging.tenant_id,
    staging_id: stagingId,
    product_id: productId,
    variant_id: variant.id,
    promoted_by: user?.id ?? null,
  })

  revalidatePath("/admin/providers")
  revalidatePath("/admin/products")
  return { success: true, productId }
}

export async function rejectStagingAction(stagingId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("catalog_staging")
    .update({ status: "rejected" })
    .eq("id", stagingId)
    .eq("status", "pending")

  if (error) return { success: false, error: "Could not reject listing." }
  revalidatePath("/admin/providers")
  return { success: true }
}
