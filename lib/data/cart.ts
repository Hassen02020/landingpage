import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export const CART_COOKIE = "petora_cart_id"

export type CartItemData = {
  id: string
  variantId: string
  sku: string
  productSlug: string
  productName: string
  variantLabel: string | null
  imageUrl: string | null
  unitPriceCents: number
  quantity: number
  inStock: boolean
}

export type CartData = {
  id: string | null
  items: CartItemData[]
  subtotalCents: number
  itemCount: number
}

const EMPTY_CART: CartData = { id: null, items: [], subtotalCents: 0, itemCount: 0 }

export async function getCart(): Promise<CartData> {
  try {
    const cookieStore = await cookies()
    const cartId = cookieStore.get(CART_COOKIE)?.value
    if (!cartId) return EMPTY_CART

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("cart_items")
      .select(
        `id, quantity, variant_id,
         product_variants(id, sku, size, flavor, price_cents,
           products(slug, name),
           product_images(url, sort_order),
           inventory(quantity_available))`
      )
      .eq("cart_id", cartId)

    if (error || !data) return EMPTY_CART

    const items: CartItemData[] = (data as any[]).map((row) => {
      const variant = row.product_variants
      const product = variant?.products
      const images = [...(variant?.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
      const inventory = Array.isArray(variant?.inventory) ? variant.inventory[0] : variant?.inventory

      return {
        id: row.id,
        variantId: row.variant_id,
        sku: variant?.sku ?? "",
        productSlug: product?.slug ?? "",
        productName: product?.name ?? "Product",
        variantLabel: [variant?.size, variant?.flavor].filter(Boolean).join(" / ") || null,
        imageUrl: images[0]?.url ?? null,
        unitPriceCents: variant?.price_cents ?? 0,
        quantity: row.quantity,
        inStock: (inventory?.quantity_available ?? 0) > 0,
      }
    })

    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

    return { id: cartId, items, subtotalCents, itemCount }
  } catch (err) {
    console.error("getCart:", err instanceof Error ? err.message : err)
    return EMPTY_CART
  }
}
