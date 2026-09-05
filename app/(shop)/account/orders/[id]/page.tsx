import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getOrderById } from "@/lib/data/orders"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Order Details" }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const order = await getOrderById(id, user.id)
  if (!order) notFound()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">Items</h2>
        <div className="mt-3 space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ink-700">
                {item.productName}
                {item.variantLabel ? ` — ${item.variantLabel}` : ""} &times; {item.quantity}
              </span>
              <span className="font-medium text-ink">{formatPrice(item.totalCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-ink-100 pt-4 text-sm font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      {order.shippingAddress && (
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">Shipping Address</h2>
          <p className="mt-2 text-sm text-ink-600">{order.shippingAddress.fullName}</p>
          <p className="text-sm text-ink-600">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
          </p>
          <p className="text-sm text-ink-600">
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
          </p>
        </div>
      )}
    </div>
  )
}
