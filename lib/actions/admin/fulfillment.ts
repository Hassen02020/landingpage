"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getProviderAdapter } from "@/lib/providers/registry"

export type CheckFulfillmentState =
  | { success: true; itemsChecked: number }
  | { success: false; error: string }

/**
 * Re-checks fulfillment status with the supplier for every placed
 * (order_routing.status = 'placed') item on an order.
 */
export async function checkFulfillmentAction(orderId: string): Promise<CheckFulfillmentState> {
  const supabase = await createClient()

  const { data: routes } = await supabase
    .from("order_routing")
    .select("id, provider_order_id, providers(code)")
    .eq("order_id", orderId)
    .eq("status", "placed")

  if (!routes || routes.length === 0) return { success: true, itemsChecked: 0 }

  let itemsChecked = 0

  for (const route of routes as any[]) {
    const code = route.providers?.code
    if (!code || !route.provider_order_id) continue

    try {
      const adapter = getProviderAdapter(code)
      const status = await adapter.fetchFulfillmentStatus(route.provider_order_id)

      await supabase
        .from("order_routing")
        .update({
          fulfillment_status: status.status,
          carrier: status.carrier ?? null,
          tracking_number: status.trackingNumber ?? null,
          tracking_url: status.trackingUrl ?? null,
          shipped_at: status.shippedAt ?? null,
          delivered_at: status.deliveredAt ?? null,
          fulfillment_checked_at: new Date().toISOString(),
        })
        .eq("id", route.id)

      itemsChecked++
    } catch {
      // A single supplier's status check failing shouldn't block checking
      // the rest of the order's items — this route just keeps its last
      // known fulfillment_status until the next check succeeds.
      continue
    }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true, itemsChecked }
}
