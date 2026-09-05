import type { Metadata } from "next"
import { CheckCircle2 } from "lucide-react"
import { ButtonLink } from "@/components/ui/Button"
import { PurchaseTracker } from "@/components/analytics/PurchaseTracker"
import { getOrderByStripeSessionId } from "@/lib/data/orders"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Order Confirmed" }

export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  const order = session_id ? await getOrderByStripeSessionId(session_id) : null

  if (!order) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Confirming your order...</h1>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          Your payment went through. We&apos;re finishing up your order — refresh in a few seconds, or check your
          email and order history shortly.
        </p>
        <ButtonLink href="/account/orders" className="mt-6">
          View My Orders
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="container py-16">
      <PurchaseTracker orderId={order.orderNumber} valueCents={order.totalCents} items={order.items} />
      <div className="mx-auto max-w-lg text-center">
        <CheckCircle2 className="mx-auto text-forest" size={48} />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Thank you for your order!</h1>
        <p className="mt-2 text-sm text-ink-500">
          Order <span className="font-medium text-ink">{order.orderNumber}</span> is confirmed. We&apos;ve sent a
          receipt to your email.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-ink-100 bg-white p-6">
        <div className="space-y-3">
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
        {order.shippingAddress && (
          <div className="mt-4 border-t border-ink-100 pt-4 text-sm text-ink-600">
            <p className="font-medium text-ink">Shipping to</p>
            <p>{order.shippingAddress.fullName}</p>
            <p>{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}</p>
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/account/orders" variant="outline">
          View Order
        </ButtonLink>
        <ButtonLink href="/">Continue Shopping</ButtonLink>
      </div>
    </div>
  )
}
