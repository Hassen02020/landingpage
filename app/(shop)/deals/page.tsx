import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getDeals } from "@/lib/data/catalog"

export const metadata: Metadata = { title: "Deals", description: "Current deals and markdowns at PETORA." }

export default async function DealsPage() {
  const products = await getDeals()
  return (
    <ProductGrid
      title="Deals"
      subtitle="Limited-time savings on food, treats and essentials."
      products={products}
      emptyMessage="No active deals right now — check back soon."
    />
  )
}
