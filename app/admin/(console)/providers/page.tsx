import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { ProviderSyncButton } from "@/components/admin/ProviderSyncButton"
import { StagingRowActions } from "@/components/admin/StagingRowActions"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Providers" }

const CONNECTION_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  connected: "forest",
  error: "coral",
  disconnected: "outline",
}

const SYNC_STATUS_VARIANT: Record<string, "forest" | "sand" | "outline"> = {
  succeeded: "forest",
  running: "sand",
  failed: "outline",
}

export default async function AdminProvidersPage() {
  const supabase = await createClient()

  // Single-tenant admin UX for now — a tenant switcher is Phase 16
  // (SaaS Dashboard). Every seeded row still points at the 'petora' tenant.
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", "petora").single()
  const tenantId = tenant?.id

  const [{ data: providers }, { data: connections }, { data: syncRuns }, { data: staged }] = await Promise.all([
    supabase.from("providers").select("id, code, name, status").order("code"),
    tenantId
      ? supabase.from("provider_connections").select("provider_id, status, connected_at, last_error").eq("tenant_id", tenantId)
      : Promise.resolve({ data: [] as { provider_id: string; status: string; connected_at: string | null; last_error: string | null }[] }),
    tenantId
      ? supabase
          .from("provider_sync_runs")
          .select("id, status, items_fetched, items_staged, started_at, finished_at, error, providers(name)")
          .eq("tenant_id", tenantId)
          .order("started_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    tenantId
      ? supabase
          .from("catalog_staging")
          .select("id, supplier_sku, name, price_cents, stock, shipping_cents, supplier, status, matched_product_id, providers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const connectionByProvider = new Map((connections ?? []).map((c) => [c.provider_id, c]))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Providers</h1>
        <p className="mt-1 text-sm text-ink-500">
          Supplier connections that feed the catalog (Commerce OS Phase 9). Only the mock adapter is live — the rest are
          registered so status is visible without pretending they work.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Adapter status</th>
              <th className="px-4 py-3">Connection</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(providers ?? []).map((provider) => {
              const connection = connectionByProvider.get(provider.id)
              const connectionStatus = connection?.status ?? "disconnected"
              return (
                <tr key={provider.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink">{provider.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={provider.status === "available" ? "forest" : "outline"} className="capitalize">
                      {provider.status === "available" ? "Available" : "Coming soon"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={CONNECTION_VARIANT[connectionStatus]} className="capitalize">
                      {connectionStatus}
                    </Badge>
                    {connection?.last_error && <p className="mt-1 text-xs text-coral-600">{connection.last_error}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {provider.status === "available" && tenantId ? (
                      <ProviderSyncButton tenantId={tenantId} providerCode={provider.code} />
                    ) : (
                      <span className="text-xs text-ink-400">Not connected yet</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-ink">Recent sync runs</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Fetched</th>
                <th className="px-4 py-3 text-right">Staged</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody>
              {(syncRuns ?? []).map((run: any) => (
                <tr key={run.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 text-ink-600">{run.providers?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={SYNC_STATUS_VARIANT[run.status]} className="capitalize">
                      {run.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-700">{run.items_fetched}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{run.items_staged}</td>
                  <td className="px-4 py-3 text-ink-500">{new Date(run.started_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!syncRuns || syncRuns.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    No sync runs yet — click &ldquo;Sync now&rdquo; above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-ink">Staged catalog</h2>
        <p className="mt-1 text-sm text-ink-500">
          Normalized listings pulled from providers. Promoting one creates a draft product — nothing here reaches the
          storefront until a staffer reviews and publishes it.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Supplier SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Shipping</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(staged ?? []).map((row: any) => (
                <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{row.supplier_sku}</td>
                  <td className="px-4 py-3 text-ink">{row.name}</td>
                  <td className="px-4 py-3 text-ink-600">{row.supplier}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{formatPrice(row.price_cents)}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{row.stock}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{formatPrice(row.shipping_cents)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.status === "promoted" ? "forest" : row.status === "rejected" ? "outline" : "sand"} className="capitalize">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "pending" ? (
                      <StagingRowActions stagingId={row.id} matchedProductId={row.matched_product_id} />
                    ) : row.status === "promoted" && row.matched_product_id ? (
                      <StagingRowActions stagingId={row.id} matchedProductId={row.matched_product_id} />
                    ) : (
                      <span className="text-xs text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!staged || staged.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-ink-500">
                    Nothing staged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
