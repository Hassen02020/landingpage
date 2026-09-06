import { z } from "zod"

export const petSchema = z.object({
  name: z.string().min(1, "Name is required."),
  species: z.enum(["dog", "cat"]),
  breed: z.string().optional(),
  weightLbs: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  activityLevel: z.enum(["low", "moderate", "high"]).optional(),
  lifeStage: z.enum(["puppy_kitten", "adult", "senior"]).optional(),
  budget: z.enum(["value", "standard", "premium"]).optional(),
  allergies: z.string().optional(),
})

export type PetInput = z.infer<typeof petSchema>
