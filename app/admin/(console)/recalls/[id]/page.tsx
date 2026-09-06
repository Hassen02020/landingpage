import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { ResolveRecallButton } from "@/components/admin/ResolveRecallButton"

export const metadata: Metadata = { title: "Recall Details" }

export default async function AdminRecallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recall } = await supabase
    .from("recalls")
    .select(
      "id, reason, severity, status, initiated_at, variant_id, product_variants(sku, products(name)), inventory_lots(lot_number, received_at)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!recall) notFound()

  let itemsQuery = supabase
    .from("order_items")
    .select("order_id, quantity, orders!inner(order_number, email, status, created_at)")
    .eq("variant_id", recall.variant_id)

  const lot = recall.inventory_lots as any
  if (lot?.received_at) {
    itemsQuery = itemsQuery.gte("orders.created_at", lot.received_at)
  }

  const { data: affected } = await itemsQuery.order("created_at", { foreignTable: "orders", ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {(recall.product_variants as any)?.products?.name ?? "—"}{" "}
            <span className="text-base font-normal text-ink-400">({(recall.product_variants as any)?.sku})</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">{recall.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={recall.status === "active" ? "coral" : "outline"} className="capitalize">
            {recall.status}
          </Badge>
          {recall.status === "active" && <ResolveRecallButton recallId={recall.id} />}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-sand-300 bg-sand-50 p-4 text-sm text-ink-700">
        No email provider is configured in this environment, so PETORA can&apos;t send recall notices automatically.
        The list below is every order containing this item{lot?.lot_number ? ` placed since lot ${lot.lot_number} arrived` : ""}
        , for manual customer outreach.
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer email</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Ordered</th>
            </tr>
          </thead>
          <tbody>
            {((affected as any[]) ?? []).map((item, i) => (
              <tr key={i} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink">{item.orders?.order_number}</td>
                <td className="px-4 py-3 text-ink-600">{item.orders?.email}</td>
                <td className="px-4 py-3 text-right text-ink-700">{item.quantity}</td>
                <td className="px-4 py-3 text-ink-500">{new Date(item.orders?.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {(!affected || affected.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                  No orders contain this item{lot?.lot_number ? " since that lot arrived" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
