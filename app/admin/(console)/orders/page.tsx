import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Orders" }

export default async function AdminOrdersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, email, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  const orders = data ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Orders</h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-forest hover:underline">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-600">{order.email}</td>
                <td className="px-4 py-3 text-ink-600">
                  {new Date(order.created_at).toLocaleDateString("en-US")}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">{formatPrice(order.total_cents)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
