"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const profileSchema = z.object({
  fullName: z.string().min(1, "Name is required."),
  phone: z.string().optional(),
})

export type ProfileActionState = { error?: string; success?: boolean } | undefined

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id)

  if (error) return { error: "Could not update profile." }

  revalidatePath("/account/profile")
  return { success: true }
}
