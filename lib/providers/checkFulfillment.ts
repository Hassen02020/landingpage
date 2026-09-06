import type { SupabaseClient } from "@supabase/supabase-js"
import { getProviderAdapter } from "@/lib/providers/registry"

export type FulfillmentCheckResult = { success: true; itemsChecked: number } | { success: false; error: string }

// order_routing.fulfillment_status -> shipments.status. 'processing' has no
// tracking info yet, so it doesn't produce a shipment row at all — the
// customer sees nothing until there's something real to show.
const SHIPMENT_STATUS: Record<string, "shipped" | "delivered" | "exception"> = {
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "exception",
}

type RouteRow = {
  id: string
  order_id: string
  provider_order_id: string | null
  providers: { code: string } | null
}

/**
 * Re-checks fulfillment status with the supplier for a set of already-
 * fetched 'placed' order_routing rows, carrying real tracking info into
 * `shipments` (Phase 15) once available. Shared by the per-order admin
 * action and the tenant-wide automation cron job (Phase 18).
 */
async function checkFulfillmentForRoutes(supabase: SupabaseClient, routes: RouteRow[]): Promise<number> {
  let itemsChecked = 0

  for (const route of routes) {
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

      const shipmentStatus = SHIPMENT_STATUS[status.status]
      if (shipmentStatus) {
        await supabase.from("shipments").upsert(
          {
            order_id: route.order_id,
            order_routing_id: route.id,
            carrier: status.carrier ?? null,
            tracking_number: status.trackingNumber ?? null,
            tracking_url: status.trackingUrl ?? null,
            status: shipmentStatus,
            shipped_at: status.shippedAt ?? null,
            delivered_at: status.deliveredAt ?? null,
          },
          { onConflict: "order_routing_id" }
        )
      }

      itemsChecked++
    } catch {
      // A single supplier's status check failing shouldn't block checking
      // the rest — that route just keeps its last known fulfillment_status
      // until the next check succeeds.
      continue
    }
  }

  return itemsChecked
}

export async function checkFulfillmentForOrder(supabase: SupabaseClient, orderId: string): Promise<FulfillmentCheckResult> {
  const { data: routes } = await supabase
    .from("order_routing")
    .select("id, order_id, provider_order_id, providers(code)")
    .eq("order_id", orderId)
    .eq("status", "placed")

  const itemsChecked = await checkFulfillmentForRoutes(supabase, (routes as any[]) ?? [])
  return { success: true, itemsChecked }
}

/** Same check, but across every placed order for a tenant — what the automation cron runs. */
export async function checkFulfillmentForTenant(supabase: SupabaseClient, tenantId: string): Promise<FulfillmentCheckResult> {
  const { data: routes } = await supabase
    .from("order_routing")
    .select("id, order_id, provider_order_id, providers(code)")
    .eq("tenant_id", tenantId)
    .eq("status", "placed")

  const itemsChecked = await checkFulfillmentForRoutes(supabase, (routes as any[]) ?? [])
  return { success: true, itemsChecked }
}
