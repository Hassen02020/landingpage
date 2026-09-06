import { redirect } from "next/navigation"
import type { Metadata } from "next"
import Image from "next/image"
import { CheckoutForm } from "@/components/checkout/CheckoutForm"
import { CheckoutTracker } from "@/components/analytics/CheckoutTracker"
import { getCart } from "@/lib/data/cart"
import { createClient } from "@/lib/supabase/server"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Checkout" }

export default async function CheckoutPage() {
  const cart = await getCart()
  if (cart.items.length === 0) redirect("/cart")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Checkout</h1>
      <CheckoutTracker
        items={cart.items.map((i) => ({ id: i.variantId, name: i.productName, priceCents: i.unitPriceCents, quantity: i.quantity }))}
        valueCents={cart.subtotalCents}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <CheckoutForm defaultEmail={user?.email} totalCents={cart.subtotalCents} />

        <div className="h-fit rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Order Summary</h2>
          <div className="mt-4 space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt={item.productName} fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-ink">{item.productName}</p>
                  {item.variantLabel && <p className="text-xs text-ink-500">{item.variantLabel}</p>}
                  <p className="text-xs text-ink-500">Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-medium text-ink">
                  {formatPrice(item.unitPriceCents * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>Subtotal</span>
              <span>{formatPrice(cart.subtotalCents)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">Shipping and tax are added on the payment step.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
