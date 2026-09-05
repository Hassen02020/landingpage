import Image from "next/image"
import Link from "next/link"
import { StarRating } from "@/components/ui/StarRating"
import { Badge } from "@/components/ui/Badge"
import { AddToCartButton } from "@/components/product/AddToCartButton"
import { WishlistButton } from "@/components/product/WishlistButton"
import { formatPrice, cn } from "@/lib/utils"
import type { ProductCardData } from "@/lib/types"

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const onSale =
    product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents
  const discountPct = onSale
    ? Math.round((1 - product.priceCents / product.compareAtPriceCents!) * 100)
    : 0

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-ink-100 bg-white p-3 shadow-card transition-shadow hover:shadow-popover",
        className
      )}
    >
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-xl bg-sand-100">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {onSale && (
          <Badge variant="coral" className="absolute left-2 top-2">
            -{discountPct}%
          </Badge>
        )}
        <WishlistButton productId={product.id} />
      </Link>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        {product.brandName && (
          <span className="text-xs font-medium uppercase tracking-wide text-forest">{product.brandName}</span>
        )}
        <Link href={`/product/${product.slug}`} className="line-clamp-2 text-sm font-medium text-ink hover:underline">
          {product.name}
        </Link>
        <StarRating rating={product.rating} count={product.reviewCount} />

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-ink">{formatPrice(product.priceCents)}</span>
            {onSale && (
              <span className="text-xs text-ink-400 line-through">
                {formatPrice(product.compareAtPriceCents!)}
              </span>
            )}
          </div>
          <AddToCartButton
            variantId={product.defaultVariantId}
            trackingItem={{ name: product.name, priceCents: product.priceCents }}
          />
        </div>
      </div>
    </div>
  )
}
