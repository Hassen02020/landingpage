"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { receiveLotSchema } from "@/lib/validations/admin-lot"

export type AdminActionState = { error?: string } | undefined

/**
 * Records a new batch of stock arriving under a lot number, and restocks
 * inventory via Phase 12's apply_inventory_delta — the same atomic,
 * tenant-checked RPC the provider inventory sync and return restocking
 * both already use.
 */
export async function receiveLotAction(_prevState: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = receiveLotSchema.safeParse({
    variantId: formData.get("variantId"),
    lotNumber: formData.get("lotNumber"),
    quantityReceived: formData.get("quantityReceived"),
    expiryDate: formData.get("expiryDate") || undefined,
    notes: formData.get("notes") || undefined,
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

  const { error } = await supabase.from("inventory_lots").insert({
    tenant_id: product.tenant_id,
    variant_id: d.variantId,
    lot_number: d.lotNumber,
    quantity_received: d.quantityReceived,
    expiry_date: d.expiryDate || null,
    notes: d.notes || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { error: error.code === "23505" ? "This lot number already exists for this item." : "Could not record lot." }
  }

  await supabase.rpc("apply_inventory_delta", { p_variant_id: d.variantId, p_delta: d.quantityReceived })

  revalidatePath("/admin/lots")
  revalidatePath("/admin/inventory")
  redirect("/admin/lots")
}
