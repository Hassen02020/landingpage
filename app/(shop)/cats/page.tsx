import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getProductsByPet } from "@/lib/data/catalog"

export const metadata: Metadata = {
  title: "Shop Cats",
  description: "Premium food, treats and essentials for cats.",
}

export default async function CatsPage() {
  const products = await getProductsByPet("cat")
  return <ProductGrid title="Cat Essentials" products={products} />
}
