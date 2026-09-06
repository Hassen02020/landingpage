import type { Metadata } from "next"
import { X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { removeFromWishlistAction } from "@/lib/actions/wishlist"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "My Wishlist" }

export default async function WishlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = user
    ? await supabase
        .from("wishlist_items")
        .select(
          "id, wishlists!inner(customer_id), products(slug, name, avg_rating, review_count, product_images(url, sort_order), product_variants(price_cents, is_default))"
        )
        .eq("wishlists.customer_id", user.id)
    : { data: null }

  const items = (data as any[] | null) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Wishlist</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">Your wishlist is empty. Tap the heart on any product to save it.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => {
            const product = item.products
            const image = [...(product?.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)[0]
            const variant =
              product?.product_variants?.find((v: any) => v.is_default) ?? product?.product_variants?.[0]

            return (
              <div key={item.id} className="relative rounded-2xl border border-ink-100 bg-white p-3">
                <form action={removeFromWishlistAction.bind(null, item.id)}>
                  <button
                    type="submit"
                    aria-label="Remove from wishlist"
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-500 hover:text-coral"
                  >
                    <X size={16} />
                  </button>
                </form>
                <Link href={`/product/${product?.slug}`} className="relative block aspect-square overflow-hidden rounded-xl bg-sand-100">
                  {image?.url && <Image src={image.url} alt={product?.name ?? ""} fill sizes="200px" className="object-cover" />}
                </Link>
                <Link href={`/product/${product?.slug}`} className="mt-2 block text-sm font-medium text-ink hover:underline">
                  {product?.name}
                </Link>
                {variant && <p className="text-sm font-semibold text-ink">{formatPrice(variant.price_cents)}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
