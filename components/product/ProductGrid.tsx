import { ProductCard } from "@/components/product/ProductCard"
import { cn } from "@/lib/utils"
import type { ProductCardData } from "@/lib/types"

export function ProductGrid({
  title,
  subtitle,
  products,
  emptyMessage = "No products found.",
  bare = false,
  titleAs: TitleTag = "h1",
}: {
  title: string
  subtitle?: string
  products: ProductCardData[]
  emptyMessage?: string
  bare?: boolean
  titleAs?: "h1" | "h2"
}) {
  return (
    <div className={cn(!bare && "container py-10")}>
      <TitleTag className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</TitleTag>
      {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}

      {products.length === 0 ? (
        <p className="mt-10 text-sm text-ink-500">{emptyMessage}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
