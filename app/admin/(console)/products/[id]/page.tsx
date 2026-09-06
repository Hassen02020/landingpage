import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ProductForm } from "@/components/admin/ProductForm"
import { updateProductAction } from "@/lib/actions/admin/products"

export const metadata: Metadata = { title: "Edit Product" }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product }, { data: brands }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, brand_id, category_id, pet_type, life_stage, status, is_subscribable, short_description,
         description, ingredients, feeding_instructions, seo_title, seo_description,
         product_variants(id, sku, size, price_cents, compare_at_price_cents, is_default, inventory(quantity_available)),
         product_images(url, sort_order)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ])

  if (!product) notFound()

  const variant =
    (product.product_variants as any[])?.find((v) => v.is_default) ?? (product.product_variants as any[])?.[0]
  const image = [...((product.product_images as any[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]
  const inventory = Array.isArray(variant?.inventory) ? variant.inventory[0] : variant?.inventory

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Edit Product</h1>
      <div className="mt-6">
        <ProductForm
          action={updateProductAction.bind(null, product.id, variant?.id ?? null)}
          brands={brands ?? []}
          categories={categories ?? []}
          submitLabel="Save Changes"
          defaultValues={{
            name: product.name,
            brandId: product.brand_id,
            categoryId: product.category_id,
            petType: product.pet_type,
            lifeStage: product.life_stage,
            status: product.status,
            isSubscribable: product.is_subscribable,
            shortDescription: product.short_description,
            description: product.description,
            ingredients: product.ingredients,
            feedingInstructions: product.feeding_instructions,
            seoTitle: product.seo_title,
            seoDescription: product.seo_description,
            sku: variant?.sku ?? "",
            size: variant?.size ?? null,
            priceCents: variant?.price_cents ?? 0,
            compareAtPriceCents: variant?.compare_at_price_cents ?? null,
            quantityAvailable: inventory?.quantity_available ?? 0,
            imageUrl: image?.url ?? null,
          }}
        />
      </div>
    </div>
  )
}
