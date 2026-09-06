"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createRecallSchema } from "@/lib/validations/admin-recall"

export type AdminActionState = { error?: string } | undefined

export async function createRecallAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = createRecallSchema.safeParse({
    variantId: formData.get("variantId"),
    lotNumber: formData.get("lotNumber") || undefined,
    reason: formData.get("reason"),
    severity: formData.get("severity"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const d = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: product } = await supabase
    .from("products")
    .select("tenant_id, product_variants!inner(id)")
    .eq("product_variants.id", d.variantId)
    .single()

  if (!product) return { error: "Variant not found." }

  let lotId: string | null = null
  if (d.lotNumber) {
    const { data: lot } = await supabase
      .from("inventory_lots")
      .select("id")
      .eq("variant_id", d.variantId)
      .eq("lot_number", d.lotNumber)
      .maybeSingle()
    if (!lot) return { error: "No recorded lot with that number for this item." }
    lotId = lot.id
  }

  const { error } = await supabase.from("recalls").insert({
    tenant_id: product.tenant_id,
    variant_id: d.variantId,
    lot_id: lotId,
    reason: d.reason,
    severity: d.severity,
    initiated_by: user?.id ?? null,
  })

  if (error) return { error: "Could not create recall." }

  revalidatePath("/admin/recalls")
  redirect("/admin/recalls")
}

export async function resolveRecallAction(recallId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("recalls")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", recallId)
    .eq("status", "active")

  if (error) return { success: false, error: "Could not resolve recall." }
  revalidatePath("/admin/recalls")
  return { success: true }
}
