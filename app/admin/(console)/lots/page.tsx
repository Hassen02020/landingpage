import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { LotForm } from "@/components/admin/LotForm"

export const metadata: Metadata = { title: "Inventory Lots" }

export default async function AdminLotsPage() {
  const supabase = await createClient()

  const [{ data: variants }, { data: lots }] = await Promise.all([
    supabase.from("product_variants").select("id, sku, products(name)").order("sku"),
    supabase
      .from("inventory_lots")
      .select("id, lot_number, quantity_received, received_at, expiry_date, notes, product_variants(sku, products(name))")
      .order("received_at", { ascending: false })
      .limit(200),
  ])

  const variantOptions = ((variants as any[]) ?? []).map((v) => ({
    id: v.id,
    label: `${v.products?.name ?? "—"} (${v.sku})`,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Inventory Lots</h1>
        <p className="mt-1 text-sm text-ink-500">
          A receiving ledger for traceability (Commerce OS Phase 17) — which lots came in, how much, and when.
          Recording a lot also restocks inventory.
        </p>
      </div>

      <LotForm variants={variantOptions} />

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Lot #</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {((lots as any[]) ?? []).map((lot) => (
              <tr key={lot.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 text-ink">
                  {lot.product_variants?.products?.name ?? "—"}{" "}
                  <span className="text-ink-400">({lot.product_variants?.sku})</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-500">{lot.lot_number}</td>
                <td className="px-4 py-3 text-right text-ink-700">{lot.quantity_received}</td>
                <td className="px-4 py-3 text-ink-500">{new Date(lot.received_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-ink-500">{lot.expiry_date ?? "—"}</td>
              </tr>
            ))}
            {(!lots || lots.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No lots recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
