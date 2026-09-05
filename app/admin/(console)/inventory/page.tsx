import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { InventoryQuantityInput } from "@/components/admin/InventoryQuantityInput"

export const metadata: Metadata = { title: "Inventory" }

export default async function AdminInventoryPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("inventory")
    .select("variant_id, quantity_available, low_stock_threshold, product_variants(sku, size, products(name))")
    .order("quantity_available", { ascending: true })
    .limit(300)

  const rows = data ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Inventory</h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((row) => (
              <tr key={row.variant_id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 text-ink-700">{row.product_variants?.products?.name}</td>
                <td className="px-4 py-3 text-ink-500">{row.product_variants?.sku}</td>
                <td className="px-4 py-3 text-ink-500">{row.product_variants?.size ?? "—"}</td>
                <td className="px-4 py-3">
                  <InventoryQuantityInput variantId={row.variant_id} initialQuantity={row.quantity_available} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                  No inventory records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
