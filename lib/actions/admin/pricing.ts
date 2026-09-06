"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { pricingRuleSchema } from "@/lib/validations/admin-pricing"

export type AdminActionState = { error?: string } | undefined

export async function createPricingRuleAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const tenantId = formData.get("tenantId")
  if (typeof tenantId !== "string" || !tenantId) return { error: "Missing tenant." }

  const parsed = pricingRuleSchema.safeParse({
    name: formData.get("name"),
    markupType: formData.get("markupType"),
    markupValue: formData.get("markupValue"),
    minMarginCents: formData.get("minMarginCents"),
    isDefault: formData.get("isDefault") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const d = parsed.data

  const supabase = await createClient()

  // Postgres enforces "at most one default per tenant" via a partial unique
  // index (migration 0013) — clear the existing default first so setting a
  // new one can't collide with it. Two admins racing this is an accepted
  // gap for a foundation-phase single-operator console.
  if (d.isDefault) {
    await supabase.from("pricing_rules").update({ is_default: false }).eq("tenant_id", tenantId).eq("is_default", true)
  }

  const { error } = await supabase.from("pricing_rules").insert({
    tenant_id: tenantId,
    name: d.name,
    markup_type: d.markupType,
    markup_value: d.markupValue,
    min_margin_cents: d.minMarginCents,
    is_default: d.isDefault,
  })

  if (error) return { error: "Could not create pricing rule." }

  revalidatePath("/admin/pricing")
  redirect("/admin/pricing")
}

export async function setDefaultPricingRuleAction(ruleId: string, tenantId: string) {
  const supabase = await createClient()
  await supabase.from("pricing_rules").update({ is_default: false }).eq("tenant_id", tenantId).eq("is_default", true)
  const { error } = await supabase.from("pricing_rules").update({ is_default: true }).eq("id", ruleId)
  if (error) return { success: false, error: "Could not set default." }
  revalidatePath("/admin/pricing")
  return { success: true }
}

export async function deletePricingRuleAction(ruleId: string) {
  const supabase = await createClient()
  await supabase.from("pricing_rules").delete().eq("id", ruleId)
  revalidatePath("/admin/pricing")
}
