import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getBrandBySlug, getProductsByBrand } from "@/lib/data/catalog"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) return {}
  return { title: brand.name, description: `Shop ${brand.name} at PETORA.` }
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()

  const products = await getProductsByBrand(slug)

  return <ProductGrid title={brand.name} products={products} emptyMessage="No products from this brand yet." />
}
