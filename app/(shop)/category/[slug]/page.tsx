import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getCategoryBySlug, getProductsByCategory } from "@/lib/data/catalog"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return {}
  return { title: category.name, description: `Shop ${category.name.toLowerCase()} at PETORA.` }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const products = await getProductsByCategory(slug)

  return (
    <ProductGrid
      title={category.name}
      products={products}
      emptyMessage="No products in this category yet — check back soon."
    />
  )
}
