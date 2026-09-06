import type { Metadata } from "next"
import { ButtonLink } from "@/components/ui/Button"
import { CartItemRow } from "@/components/cart/CartItemRow"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getCart } from "@/lib/data/cart"
import { getBestSellers } from "@/lib/data/catalog"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Your Cart" }

export default async function CartPage() {
  const [cart, recommendations] = await Promise.all([getCart(), getBestSellers(4)])

  const hasOutOfStock = cart.items.some((item) => !item.inStock)

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Your Cart</h1>

      {cart.items.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-ink-500">Your cart is empty.</p>
          <ButtonLink href="/" className="mt-4 inline-flex">
            Continue Shopping
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          <div className="h-fit rounded-2xl border border-ink-100 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Order Summary</h2>
            <div className="mt-4 flex justify-between text-sm text-ink-600">
              <span>Subtotal</span>
              <span>{formatPrice(cart.subtotalCents)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">Shipping and tax calculated at checkout.</p>
            {hasOutOfStock && (
              <p className="mt-3 text-xs font-medium text-coral-600">
                Remove out-of-stock items before checking out.
              </p>
            )}
            <ButtonLink
              href="/checkout"
              size="lg"
              className={`mt-5 w-full ${hasOutOfStock ? "pointer-events-none opacity-50" : ""}`}
            >
              Checkout
            </ButtonLink>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-12 border-t border-ink-100 pt-8">
          <ProductGrid title="You May Also Like" products={recommendations} bare titleAs="h2" />
        </div>
      )}
    </div>
  )
}
