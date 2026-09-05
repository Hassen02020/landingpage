"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getProviderAdapter } from "@/lib/providers/registry"
import { computeInventoryDelta } from "@/lib/inventory/delta"

export type InventorySyncState =
  | { success: true; itemsChecked: number; itemsAdjusted: number }
  | { success: false; error: string }

/**
 * Re-checks live stock with a provider for every promoted listing and
 * applies the movement since the last sync (see migration 0014 for why
 * this is a delta, not an overwrite).
 */
export async function runInventorySyncAction(tenantId: string, providerCode: string): Promise<InventorySyncState> {
  const supabase = await createClient()

  const { data: provider } = await supabase.from("providers").select("id, status").eq("code", providerCode).single()
  if (!provider) return { success: false, error: "Unknown provider." }
  if (provider.status !== "available") return { success: false, error: "This provider isn't connected yet." }

  let adapter
  try {
    adapter = getProviderAdapter(providerCode)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Adapter not available." }
  }

  const { data: run, error: runError } = await supabase
    .from("inventory_sync_runs")
    .insert({ tenant_id: tenantId, provider_id: provider.id, status: "running" })
    .select("id")
    .single()
  if (runError || !run) return { success: false, error: "Could not start inventory sync run." }

  const { data: staged } = await supabase
    .from("catalog_staging")
    .select("id, supplier_sku, last_synced_stock, catalog_mappings(variant_id)")
    .eq("tenant_id", tenantId)
    .eq("provider_id", provider.id)
    .eq("status", "promoted")

  let itemsChecked = 0
  let itemsAdjusted = 0

  try {
    for (const row of staged ?? []) {
      const variantId = row.catalog_mappings?.[0]?.variant_id
      if (!variantId) continue

      itemsChecked++
      const stock = await adapter.fetchStock(row.supplier_sku)
      const delta = computeInventoryDelta(row.last_synced_stock, stock.quantity)

      if (delta !== 0) {
        const { data: applied } = await supabase.rpc("apply_inventory_delta", { p_variant_id: variantId, p_delta: delta })
        if (applied) itemsAdjusted++
      }

      await supabase.from("catalog_staging").update({ last_synced_stock: stock.quantity }).eq("id", row.id)
    }

    await supabase
      .from("inventory_sync_runs")
      .update({
        status: "succeeded",
        items_checked: itemsChecked,
        items_adjusted: itemsAdjusted,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    revalidatePath("/admin/providers")
    revalidatePath("/admin/inventory")
    return { success: true, itemsChecked, itemsAdjusted }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error."
    await supabase
      .from("inventory_sync_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id)

    revalidatePath("/admin/providers")
    return { success: false, error: message }
  }
}
