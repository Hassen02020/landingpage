import { Hero } from "@/components/home/Hero"
import { PromoBanner } from "@/components/home/PromoBanner"
import { CategoryGrid } from "@/components/home/CategoryGrid"
import { ShopByPet } from "@/components/home/ShopByPet"
import { PetProfileTeaser } from "@/components/home/PetProfileTeaser"
import { BestSellers } from "@/components/home/BestSellers"
import { BrandStrip } from "@/components/home/BrandStrip"
import { getActivePromotions, getTopCategories, getBestSellers, getBrands } from "@/lib/data/catalog"

export default async function HomePage() {
  const [promotions, categories, bestSellers, brands] = await Promise.all([
    getActivePromotions(),
    getTopCategories(),
    getBestSellers(),
    getBrands(),
  ])

  return (
    <>
      <Hero />
      <PromoBanner promotions={promotions} />
      <CategoryGrid categories={categories} />
      <ShopByPet />
      <PetProfileTeaser />
      <BestSellers products={bestSellers} />
      <BrandStrip brands={brands} />
    </>
  )
}
