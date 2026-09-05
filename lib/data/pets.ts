import { createClient } from "@/lib/supabase/server"

export type Pet = {
  id: string
  name: string
  species: "dog" | "cat"
  breed: string | null
  weightLbs: number | null
  activityLevel: string | null
  lifeStage: string | null
  budget: string | null
  allergies: string[]
}

export async function getPetsForCustomer(profileId: string): Promise<Pet[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("pets")
      .select("id, name, species, breed, weight_lbs, activity_level, life_stage, budget, allergies")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    return data.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      weightLbs: p.weight_lbs,
      activityLevel: p.activity_level,
      lifeStage: p.life_stage,
      budget: p.budget,
      allergies: p.allergies ?? [],
    }))
  } catch (err) {
    console.error("getPetsForCustomer:", err instanceof Error ? err.message : err)
    return []
  }
}
