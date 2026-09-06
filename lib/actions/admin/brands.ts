"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils"

const brandSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  isActive: z.coerce.boolean(),
})

export type AdminActionState = { error?: string } | undefined

export async function createBrandAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    isActive: formData.get("isActive") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const { error } = await supabase.from("brands").insert({
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description || null,
    logo_url: parsed.data.logoUrl || null,
    is_active: parsed.data.isActive,
  })

  if (error) return { error: error.message.includes("duplicate") ? "A brand with this name already exists." : "Could not create brand." }

  revalidatePath("/admin/brands")
  redirect("/admin/brands")
}

export async function updateBrandAction(
  brandId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    isActive: formData.get("isActive") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("brands")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      logo_url: parsed.data.logoUrl || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", brandId)

  if (error) return { error: "Could not update brand." }

  revalidatePath("/admin/brands")
  redirect("/admin/brands")
}

export async function deleteBrandAction(brandId: string) {
  const supabase = await createClient()
  await supabase.from("brands").delete().eq("id", brandId)
  revalidatePath("/admin/brands")
}
