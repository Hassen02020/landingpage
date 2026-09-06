import type { SupabaseClient } from "@supabase/supabase-js"
import { getProviderAdapter } from "@/lib/providers/registry"

// Guards against a runaway adapter looping forever on a bad cursor.
const MAX_PAGES = 10

export type CatalogSyncResult =
  | { success: true; itemsFetched: number; itemsStaged: number }
  | { success: false; error: string }

/**
 * Pulls a provider's catalog into catalog_staging. Shared by the admin
 * "Sync now" action and the automation cron job (Phase 18) — same logic,
 * different caller (a tenant-staff session vs. the service-role client),
 * so this takes a plain Supabase client rather than assuming either.
 */
export async function syncProviderCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  providerCode: string
): Promise<CatalogSyncResult> {
  const { data: provider } = await supabase.from("providers").select("id, code, status").eq("code", providerCode).single()
  if (!provider) return { success: false, error: "Unknown provider." }
  if (provider.status !== "available") return { success: false, error: "This provider isn't connected yet." }

  let adapter
  try {
    adapter = getProviderAdapter(providerCode)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Adapter not available." }
  }

  const { data: run, error: runError } = await supabase
    .from("provider_sync_runs")
    .insert({ tenant_id: tenantId, provider_id: provider.id, status: "running" })
    .select("id")
    .single()
  if (runError || !run) return { success: false, error: "Could not start sync run." }

  let cursor: string | null = null
  let itemsFetched = 0
  let itemsStaged = 0

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const { listings, nextCursor } = await adapter.fetchCatalogPage(cursor)
      itemsFetched += listings.length

      for (const raw of listings) {
        const normalized = adapter.normalize(raw)
        const { error: upsertError } = await supabase.from("catalog_staging").upsert(
          {
            tenant_id: tenantId,
            provider_id: provider.id,
            sync_run_id: run.id,
            supplier_sku: normalized.supplierSku,
            name: normalized.name,
            price_cents: normalized.priceCents,
            stock: normalized.stock,
            shipping_cents: normalized.shippingCents,
            supplier: normalized.supplier,
            raw: normalized.raw,
          },
          { onConflict: "tenant_id,provider_id,supplier_sku" }
        )
        if (!upsertError) itemsStaged++
      }

      cursor = nextCursor
      if (!cursor) break
    }

    await supabase
      .from("provider_sync_runs")
      .update({
        status: "succeeded",
        items_fetched: itemsFetched,
        items_staged: itemsStaged,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    await supabase.from("provider_connections").upsert(
      { tenant_id: tenantId, provider_id: provider.id, status: "connected", connected_at: new Date().toISOString() },
      { onConflict: "tenant_id,provider_id" }
    )

    return { success: true, itemsFetched, itemsStaged }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error."
    await supabase
      .from("provider_sync_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id)
    await supabase.from("provider_connections").upsert(
      { tenant_id: tenantId, provider_id: provider.id, status: "error", last_error: message },
      { onConflict: "tenant_id,provider_id" }
    )

    return { success: false, error: message }
  }
}
