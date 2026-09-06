"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { petSchema } from "@/lib/validations/pet"

export type PetActionState = { error?: string; success?: boolean } | undefined

function parsePetForm(formData: FormData) {
  return petSchema.safeParse({
    name: formData.get("name"),
    species: formData.get("species"),
    breed: formData.get("breed") || undefined,
    weightLbs: formData.get("weightLbs") || undefined,
    activityLevel: formData.get("activityLevel") || undefined,
    lifeStage: formData.get("lifeStage") || undefined,
    budget: formData.get("budget") || undefined,
    allergies: formData.get("allergies") || undefined,
  })
}

export async function createPetAction(_prevState: PetActionState, formData: FormData): Promise<PetActionState> {
  const parsed = parsePetForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  const { error } = await supabase.from("pets").insert({
    profile_id: user.id,
    name: parsed.data.name,
    species: parsed.data.species,
    breed: parsed.data.breed || null,
    weight_lbs: parsed.data.weightLbs ?? null,
    activity_level: parsed.data.activityLevel || null,
    life_stage: parsed.data.lifeStage || null,
    budget: parsed.data.budget || null,
    allergies: parsed.data.allergies ? parsed.data.allergies.split(",").map((a) => a.trim()) : [],
  })

  if (error) return { error: "Could not save pet." }

  revalidatePath("/account/pets")
  revalidatePath("/pet-profile")
  return { success: true }
}

export async function deletePetAction(petId: string) {
  const supabase = await createClient()
  await supabase.from("pets").delete().eq("id", petId)
  revalidatePath("/account/pets")
  revalidatePath("/pet-profile")
}
