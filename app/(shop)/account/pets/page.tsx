import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getPetsForCustomer } from "@/lib/data/pets"
import { PetForm } from "@/components/account/PetForm"
import { DeletePetButton } from "@/components/account/DeletePetButton"

export const metadata: Metadata = { title: "My Pets" }

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" }

export default async function PetsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pets = user ? await getPetsForCustomer(user.id) : []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">My Pets</h1>

      {pets.length > 0 && (
        <div className="mt-6 space-y-3">
          {pets.map((pet) => (
            <div key={pet.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  {SPECIES_EMOJI[pet.species]} {pet.name}
                </p>
                <p className="text-xs text-ink-500">
                  {[pet.breed, pet.lifeStage?.replace("_", "/"), pet.weightLbs ? `${pet.weightLbs} lbs` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <DeletePetButton petId={pet.id} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Add a Pet</h2>
        <div className="mt-4">
          <PetForm />
        </div>
      </div>
    </div>
  )
}
