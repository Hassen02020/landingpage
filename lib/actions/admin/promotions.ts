"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const promotionSchema = z.object({
  title: z.string().min(1, "Title is required."),
  subtitle: z.string().optional(),
  badgeText: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  isActive: z.coerce.boolean(),
})

export type AdminActionState = { error?: string } | undefined

export async function createPromotionAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = promotionSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || undefined,
    badgeText: formData.get("badgeText") || undefined,
    ctaLabel: formData.get("ctaLabel") || undefined,
    ctaHref: formData.get("ctaHref") || undefined,
    isActive: formData.get("isActive") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const { error } = await supabase.from("promotions").insert({
    title: parsed.data.title,
    subtitle: parsed.data.subtitle || null,
    badge_text: parsed.data.badgeText || null,
    cta_label: parsed.data.ctaLabel || null,
    cta_href: parsed.data.ctaHref || null,
    is_active: parsed.data.isActive,
    placement: "homepage_banner",
  })

  if (error) return { error: "Could not create promotion." }

  revalidatePath("/admin/settings")
  revalidatePath("/")
  return {}
}

export async function togglePromotionAction(promotionId: string, isActive: boolean) {
  const supabase = await createClient()
  await supabase.from("promotions").update({ is_active: isActive }).eq("id", promotionId)
  revalidatePath("/admin/settings")
  revalidatePath("/")
}

export async function deletePromotionAction(promotionId: string) {
  const supabase = await createClient()
  await supabase.from("promotions").delete().eq("id", promotionId)
  revalidatePath("/admin/settings")
  revalidatePath("/")
}
