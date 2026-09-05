"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function getOrCreateWishlistId(customerId: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase.from("wishlists").select("id").eq("customer_id", customerId).maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from("wishlists")
    .insert({ customer_id: customerId })
    .select("id")
    .single()

  if (error || !created) throw new Error(error?.message ?? "Failed to create wishlist")
  return created.id
}

export async function addToWishlistAction(productId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in to save items to your wishlist." }

  try {
    const wishlistId = await getOrCreateWishlistId(user.id)
    await supabase.from("wishlist_items").upsert(
      { wishlist_id: wishlistId, product_id: productId },
      { onConflict: "wishlist_id,product_id", ignoreDuplicates: true }
    )
    revalidatePath("/account/wishlist")
    return { success: true }
  } catch (err) {
    console.error("addToWishlistAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not add to wishlist." }
  }
}

export async function removeFromWishlistAction(wishlistItemId: string) {
  const supabase = await createClient()
  await supabase.from("wishlist_items").delete().eq("id", wishlistItemId)
  revalidatePath("/account/wishlist")
}
