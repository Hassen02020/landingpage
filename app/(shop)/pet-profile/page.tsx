import Link from "next/link"
import type { Metadata } from "next"
import { PawPrint } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getPetsForCustomer } from "@/lib/data/pets"
import { PetForm } from "@/components/account/PetForm"
import { ButtonLink } from "@/components/ui/Button"

export const metadata: Metadata = { title: "Pet Profile" }

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" }

export default async function PetProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <PawPrint className="text-forest" size={40} />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Tell us about your pet</h1>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          Create a free PETORA account to build your pet&apos;s profile and get personalized food and product
          recommendations.
        </p>
        <ButtonLink href="/signup?redirect=/pet-profile" className="mt-6">
          Create Account
        </ButtonLink>
      </div>
    )
  }

  const pets = await getPetsForCustomer(user.id)

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Tell us about your pet</h1>
      <p className="mt-2 text-sm text-ink-500">
        We&apos;ll recommend food, treats and essentials made for your pet&apos;s breed, age and needs.
      </p>

      {pets.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Link
              key={pet.id}
              href={`/pet-profile/${pet.id}`}
              className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4 hover:shadow-card"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {SPECIES_EMOJI[pet.species]} {pet.name}
                </p>
                <p className="text-xs text-ink-500">{pet.breed ?? pet.species}</p>
              </div>
              <span className="text-xs font-medium text-forest">See Recommendations →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 max-w-2xl rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Add a Pet</h2>
        <div className="mt-4">
          <PetForm />
        </div>
      </div>
    </div>
  )
}
