import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getPetsForCustomer } from "@/lib/data/pets"
import { getRecommendationsForPet } from "@/lib/recommendations"
import { ProductGrid } from "@/components/product/ProductGrid"

export const metadata: Metadata = { title: "Recommendations" }

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" }

export default async function PetRecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const pets = await getPetsForCustomer(user.id)
  const pet = pets.find((p) => p.id === id)
  if (!pet) notFound()

  const recommendations = await getRecommendationsForPet(pet)

  return (
    <div className="container py-10">
      <p className="text-sm text-ink-500">
        {SPECIES_EMOJI[pet.species]} {pet.breed ?? pet.species}
        {pet.weightLbs ? ` · ${pet.weightLbs} lbs` : ""}
        {pet.lifeStage ? ` · ${pet.lifeStage.replace("_", "/")}` : ""}
      </p>
      <ProductGrid
        title={`Recommended for ${pet.name}`}
        products={recommendations}
        emptyMessage="We don't have a great match yet — browse the full catalog while we add more products."
        bare
        titleAs="h1"
      />
    </div>
  )
}
