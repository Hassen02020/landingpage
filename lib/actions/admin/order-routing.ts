"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getProviderAdapter } from "@/lib/providers/registry"

export type RouteOrderState =
  | { success: true; itemsRouted: number; itemsPlaced: number; itemsSkipped: number }
  | { success: false; error: string }

type RoutingInsert = {
  tenant_id: string
  order_id: string
  order_item_id: string
  variant_id: string | null
  provider_id: string | null
  status: "not_applicable" | "placed" | "failed"
  provider_order_id?: string
  error?: string
}

/**
 * Routes every not-yet-routed item on an order to the supplier it came
 * from (via catalog_mappings), placing a purchase through that provider's
 * adapter. One-shot per item — see migration 0015 for why a failed
 * routing isn't automatically retried.
 */
export async function routeOrderAction(orderId: string): Promise<RouteOrderState> {
  const supabase = await createClient()

  const { data: order } = await supabase.from("orders").select("id, tenant_id").eq("id", orderId).single()
  if (!order) return { success: false, error: "Order not found." }

  const { data: items } = await supabase.from("order_items").select("id, variant_id, quantity").eq("order_id", orderId)
  if (!items || items.length === 0) return { success: false, error: "No items on this order." }

  const { data: existing } = await supabase.from("order_routing").select("order_item_id").eq("order_id", orderId)
  const alreadyRouted = new Set((existing ?? []).map((r) => r.order_item_id))

  const record = (row: RoutingInsert) => supabase.from("order_routing").insert(row)

  let itemsRouted = 0
  let itemsPlaced = 0
  let itemsSkipped = 0

  for (const item of items) {
    if (alreadyRouted.has(item.id)) {
      itemsSkipped++
      continue
    }
    itemsRouted++

    const base = { tenant_id: order.tenant_id, order_id: orderId, order_item_id: item.id }

    if (!item.variant_id) {
      await record({ ...base, variant_id: null, provider_id: null, status: "not_applicable" })
      continue
    }

    const { data: mapping } = await supabase
      .from("catalog_mappings")
      .select("catalog_staging(provider_id, supplier_sku, providers(code, status))")
      .eq("variant_id", item.variant_id)
      .maybeSingle()

    const staging = mapping?.catalog_staging as
      | { provider_id: string; supplier_sku: string; providers: { code: string; status: string } | null }
      | undefined

    if (!staging) {
      // Not sourced from a provider (an admin-created / owned product) —
      // nothing to route, this is the normal case for most orders today.
      await record({ ...base, variant_id: item.variant_id, provider_id: null, status: "not_applicable" })
      continue
    }

    if (staging.providers?.status !== "available") {
      await record({
        ...base,
        variant_id: item.variant_id,
        provider_id: staging.provider_id,
        status: "failed",
        error: "Provider isn't connected.",
      })
      continue
    }

    try {
      const adapter = getProviderAdapter(staging.providers.code)
      const ref = await adapter.placeOrder({ supplierSku: staging.supplier_sku, quantity: item.quantity })

      if (ref.status === "placed") {
        itemsPlaced++
        await record({
          ...base,
          variant_id: item.variant_id,
          provider_id: staging.provider_id,
          status: "placed",
          provider_order_id: ref.providerOrderId,
        })
      } else {
        await record({
          ...base,
          variant_id: item.variant_id,
          provider_id: staging.provider_id,
          status: "failed",
          error: "Supplier could not fulfill this quantity.",
        })
      }
    } catch (err) {
      await record({
        ...base,
        variant_id: item.variant_id,
        provider_id: staging.provider_id,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown routing error.",
      })
    }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true, itemsRouted, itemsPlaced, itemsSkipped }
}
