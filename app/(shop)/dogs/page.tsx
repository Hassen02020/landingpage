import type { Metadata } from "next"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getProductsByPet } from "@/lib/data/catalog"

export const metadata: Metadata = {
  title: "Shop Dogs",
  description: "Premium food, treats and essentials for dogs.",
}

export default async function DogsPage() {
  const products = await getProductsByPet("dog")
  return <ProductGrid title="Dog Essentials" products={products} />
}
