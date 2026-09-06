import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getCustomerOrders } from "@/lib/data/orders"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "My Orders" }

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const orders = user ? await getCustomerOrders(user.id) : []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Orders</h1>

      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">You haven&apos;t placed any orders yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4 hover:shadow-card"
            >
              <div>
                <p className="text-sm font-medium text-ink">{order.orderNumber}</p>
                <p className="text-xs text-ink-500">
                  {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink">{formatPrice(order.totalCents)}</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
