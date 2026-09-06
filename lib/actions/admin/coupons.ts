"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { couponSchema } from "@/lib/validations/admin-coupon"

export type AdminActionState = { error?: string } | undefined

function parseCouponForm(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    minOrderCents: formData.get("minOrderCents") || 0,
    usageLimit: formData.get("usageLimit") || undefined,
    firstOrderOnly: formData.get("firstOrderOnly") === "on",
    expiresAt: formData.get("expiresAt") || undefined,
    isActive: formData.get("isActive") === "on",
  })
}

export async function createCouponAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = parseCouponForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from("coupons").insert({
    code: d.code,
    type: d.type,
    value: d.value,
    min_order_cents: d.minOrderCents,
    usage_limit: d.usageLimit ?? null,
    first_order_only: d.firstOrderOnly,
    expires_at: d.expiresAt || null,
    is_active: d.isActive,
  })

  if (error) return { error: error.message.includes("duplicate") ? "A coupon with this code already exists." : "Could not create coupon." }

  revalidatePath("/admin/coupons")
  redirect("/admin/coupons")
}

export async function toggleCouponAction(couponId: string, isActive: boolean) {
  const supabase = await createClient()
  await supabase.from("coupons").update({ is_active: isActive }).eq("id", couponId)
  revalidatePath("/admin/coupons")
}

export async function deleteCouponAction(couponId: string) {
  const supabase = await createClient()
  await supabase.from("coupons").delete().eq("id", couponId)
  revalidatePath("/admin/coupons")
}
