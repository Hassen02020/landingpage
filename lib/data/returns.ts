import { createClient } from "@/lib/supabase/server"
import { computeRemainingReturnable } from "@/lib/returns/remaining"

export type ReturnableItem = {
  id: string
  productName: string
  variantLabel: string | null
  remaining: number
}

/** Order items still eligible for a new return request, and by how much. */
export async function getReturnableItems(orderId: string, customerId: string): Promise<ReturnableItem[]> {
  const supabase = await createClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle()
  if (!order) return []

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_name, variant_label, quantity")
    .eq("order_id", orderId)
  if (!orderItems || orderItems.length === 0) return []

  const itemIds = orderItems.map((i) => i.id)
  const { data: priorReturns } = await supabase
    .from("return_items")
    .select("order_item_id, quantity, returns!inner(status)")
    .in("order_item_id", itemIds)
    .neq("returns.status", "rejected")

  const alreadyRequested: Record<string, number> = {}
  for (const row of (priorReturns as any[]) ?? []) {
    alreadyRequested[row.order_item_id] = (alreadyRequested[row.order_item_id] ?? 0) + row.quantity
  }

  const remaining = computeRemainingReturnable(orderItems, alreadyRequested)

  return orderItems.map((i) => ({
    id: i.id,
    productName: i.product_name,
    variantLabel: i.variant_label,
    remaining: remaining[i.id],
  }))
}
