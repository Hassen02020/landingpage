"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function updateInventoryAction(variantId: string, quantity: number) {
  if (quantity < 0) return { success: false, error: "Quantity cannot be negative." }

  const supabase = await createClient()
  const { error } = await supabase.from("inventory").update({ quantity_available: quantity }).eq("variant_id", variantId)

  if (error) return { success: false, error: "Could not update inventory." }

  revalidatePath("/admin/inventory")
  return { success: true }
}
