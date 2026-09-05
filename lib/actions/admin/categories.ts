"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

const categorySchema = z.object({
  name: z.string().min(1, "Name is required."),
  petType: z.enum(["dog", "cat", "both"]),
  imageUrl: z.string().optional(),
  isActive: z.coerce.boolean(),
})

export type AdminActionState = { error?: string } | undefined

export async function createCategoryAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    petType: formData.get("petType"),
    imageUrl: formData.get("imageUrl") || undefined,
    isActive: formData.get("isActive") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    pet_type: parsed.data.petType,
    image_url: parsed.data.imageUrl || null,
    is_active: parsed.data.isActive,
  })

  if (error) return { error: error.message.includes("duplicate") ? "A category with this name already exists." : "Could not create category." }

  revalidatePath("/admin/categories")
  redirect("/admin/categories")
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    petType: formData.get("petType"),
    imageUrl: formData.get("imageUrl") || undefined,
    isActive: formData.get("isActive") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      pet_type: parsed.data.petType,
      image_url: parsed.data.imageUrl || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", categoryId)

  if (error) return { error: "Could not update category." }

  revalidatePath("/admin/categories")
  redirect("/admin/categories")
}

export async function deleteCategoryAction(categoryId: string) {
  const supabase = await createClient()
  await supabase.from("categories").delete().eq("id", categoryId)
  revalidatePath("/admin/categories")
}
