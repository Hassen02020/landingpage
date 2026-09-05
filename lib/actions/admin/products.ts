"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { productSchema } from "@/lib/validations/admin-product"
import { slugify } from "@/lib/utils"

export type AdminActionState = { error?: string } | undefined

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    brandId: formData.get("brandId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    petType: formData.get("petType"),
    lifeStage: formData.get("lifeStage") || undefined,
    status: formData.get("status"),
    isSubscribable: formData.get("isSubscribable") === "on",
    shortDescription: formData.get("shortDescription") || undefined,
    description: formData.get("description") || undefined,
    ingredients: formData.get("ingredients") || undefined,
    feedingInstructions: formData.get("feedingInstructions") || undefined,
    seoTitle: formData.get("seoTitle") || undefined,
    seoDescription: formData.get("seoDescription") || undefined,
    sku: formData.get("sku"),
    size: formData.get("size") || undefined,
    priceCents: formData.get("priceCents"),
    compareAtPriceCents: formData.get("compareAtPriceCents") || undefined,
    quantityAvailable: formData.get("quantityAvailable"),
    imageUrl: formData.get("imageUrl") || undefined,
  })
}

export async function createProductAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = parseProductForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const d = parsed.data

  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: d.name,
      slug: slugify(d.name),
      brand_id: d.brandId || null,
      category_id: d.categoryId || null,
      pet_type: d.petType,
      life_stage: d.lifeStage || null,
      status: d.status,
      is_subscribable: d.isSubscribable,
      short_description: d.shortDescription || null,
      description: d.description || null,
      ingredients: d.ingredients || null,
      feeding_instructions: d.feedingInstructions || null,
      seo_title: d.seoTitle || null,
      seo_description: d.seoDescription || null,
    })
    .select("id")
    .single()

  if (productError || !product) {
    return { error: productError?.message.includes("duplicate") ? "A product with this name already exists." : "Could not create product." }
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      product_id: product.id,
      sku: d.sku,
      size: d.size || null,
      price_cents: d.priceCents,
      compare_at_price_cents: d.compareAtPriceCents ?? null,
      is_default: true,
    })
    .select("id")
    .single()

  if (variantError || !variant) {
    return { error: "Product created, but the variant could not be saved. Edit the product to add it." }
  }

  await supabase.from("inventory").insert({ variant_id: variant.id, quantity_available: d.quantityAvailable })

  if (d.imageUrl) {
    await supabase.from("product_images").insert({ product_id: product.id, url: d.imageUrl, sort_order: 1 })
  }

  revalidatePath("/admin/products")
  redirect("/admin/products")
}

export async function updateProductAction(
  productId: string,
  variantId: string | null,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = parseProductForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const d = parsed.data

  const supabase = await createClient()

  const { error: productError } = await supabase
    .from("products")
    .update({
      name: d.name,
      brand_id: d.brandId || null,
      category_id: d.categoryId || null,
      pet_type: d.petType,
      life_stage: d.lifeStage || null,
      status: d.status,
      is_subscribable: d.isSubscribable,
      short_description: d.shortDescription || null,
      description: d.description || null,
      ingredients: d.ingredients || null,
      feeding_instructions: d.feedingInstructions || null,
      seo_title: d.seoTitle || null,
      seo_description: d.seoDescription || null,
    })
    .eq("id", productId)

  if (productError) return { error: "Could not update product." }

  if (variantId) {
    await supabase
      .from("product_variants")
      .update({
        sku: d.sku,
        size: d.size || null,
        price_cents: d.priceCents,
        compare_at_price_cents: d.compareAtPriceCents ?? null,
      })
      .eq("id", variantId)

    await supabase.from("inventory").update({ quantity_available: d.quantityAvailable }).eq("variant_id", variantId)
  }

  revalidatePath("/admin/products")
  redirect("/admin/products")
}

export async function deleteProductAction(productId: string) {
  const supabase = await createClient()
  await supabase.from("products").delete().eq("id", productId)
  revalidatePath("/admin/products")
}
