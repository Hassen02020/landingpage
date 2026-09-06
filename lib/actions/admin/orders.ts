"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

const VALID_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]

export async function updateOrderStatusAction(orderId: string, status: string) {
  if (!VALID_STATUSES.includes(status)) return { success: false, error: "Invalid status." }

  const supabase = await createClient()
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId)

  if (error) return { success: false, error: "Could not update order." }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
  return { success: true }
}
