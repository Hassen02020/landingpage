import { ProductCard } from "@/components/product/ProductCard"
import type { ProductCardData } from "@/lib/types"

export function BestSellers({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) return null

  return (
    <section className="container py-10">
      <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Petora Best Sellers</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
