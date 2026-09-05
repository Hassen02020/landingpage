import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { SearchTracker } from "@/components/analytics/SearchTracker"
import { searchProducts } from "@/lib/data/catalog"

export const metadata: Metadata = { title: "Search" }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""
  const products = query ? await searchProducts(query) : []

  return (
    <>
      <SearchTracker query={query} />
      <ProductGrid
        title={query ? `Results for "${query}"` : "Search"}
        products={products}
        emptyMessage={query ? "No products matched your search." : "Enter a search term to find products."}
      />
    </>
  )
}
