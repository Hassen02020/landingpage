"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { CART_COOKIE } from "@/lib/data/cart"

async function getOrCreateCartId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CART_COOKIE)?.value
  const supabase = await createClient()

  if (existing) {
    const { data } = await supabase.from("carts").select("id").eq("id", existing).single()
    if (data) return existing
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cart, error } = await supabase
    .from("carts")
    .insert({ customer_id: user?.id ?? null, session_id: randomUUID() })
    .select("id")
    .single()

  if (error || !cart) throw new Error(error?.message ?? "Failed to create cart")

  cookieStore.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })

  return cart.id
}

export async function addToCartAction(variantId: string, quantity = 1) {
  try {
    const cartId = await getOrCreateCartId()
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", variantId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + quantity })
        .eq("id", existing.id)
    } else {
      await supabase.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity })
    }

    revalidatePath("/cart")
    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    console.error("addToCartAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not add item to cart." }
  }
}

export async function updateCartItemQuantityAction(itemId: string, quantity: number) {
  try {
    const supabase = await createClient()
    if (quantity <= 0) {
      await supabase.from("cart_items").delete().eq("id", itemId)
    } else {
      await supabase.from("cart_items").update({ quantity }).eq("id", itemId)
    }
    revalidatePath("/cart")
    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    console.error("updateCartItemQuantityAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not update cart." }
  }
}

export async function removeCartItemAction(itemId: string) {
  return updateCartItemQuantityAction(itemId, 0)
}
