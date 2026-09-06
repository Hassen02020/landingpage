import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getOrderById } from "@/lib/data/orders"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { Badge } from "@/components/ui/Badge"
import { ButtonLink } from "@/components/ui/Button"
import { formatPrice } from "@/lib/utils"

const RETURN_STATUS_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  requested: "sand",
  approved: "sand",
  received: "sand",
  refund_initiated: "forest",
  refunded: "forest",
  rejected: "outline",
  refund_failed: "coral",
}

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

      {order.shipments.length > 0 && (
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">Tracking</h2>
          <p className="mt-1 text-xs text-ink-500">
            {order.shipments.length > 1
              ? "This order shipped in multiple packages."
              : "This order shipped in one package."}
          </p>
          <div className="mt-3 space-y-3">
            {order.shipments.map((shipment, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium capitalize text-ink">{shipment.status}</p>
                  {shipment.carrier && <p className="text-xs text-ink-500">{shipment.carrier}</p>}
                </div>
                {shipment.trackingNumber &&
                  (shipment.trackingUrl ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-forest hover:underline"
                    >
                      {shipment.trackingNumber}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-ink-500">{shipment.trackingNumber}</span>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Returns</h2>
          <ButtonLink href={`/account/orders/${order.id}/return`} variant="outline" size="sm">
            Request a Return
          </ButtonLink>
        </div>
        {order.returns.length > 0 ? (
          <div className="mt-4 space-y-3">
            {order.returns.map((ret) => (
              <div key={ret.id} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  {ret.reason && <p className="text-ink-700">{ret.reason}</p>}
                  <p className="text-xs text-ink-400">
                    Requested {new Date(ret.requestedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  {ret.refundError && <p className="mt-1 text-xs text-coral-600">{ret.refundError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {ret.refundAmountCents != null && (
                    <span className="text-xs text-ink-500">{formatPrice(ret.refundAmountCents)}</span>
                  )}
                  <Badge variant={RETURN_STATUS_VARIANT[ret.status] ?? "outline"} className="capitalize">
                    {ret.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">No return requests on this order.</p>
        )}
      </div>
    </div>
  )
}
