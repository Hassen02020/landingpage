"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { addressSchema } from "@/lib/validations/address"

export type AddressActionState = { error?: string; success?: boolean } | undefined

export async function createAddressAction(
  _prevState: AddressActionState,
  formData: FormData
): Promise<AddressActionState> {
  const parsed = addressSchema.safeParse({
    label: formData.get("label") || undefined,
    fullName: formData.get("fullName"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    phone: formData.get("phone") || undefined,
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)

  const { error } = await supabase.from("addresses").insert({
    profile_id: user.id,
    label: parsed.data.label || null,
    full_name: parsed.data.fullName,
    line1: parsed.data.line1,
    line2: parsed.data.line2 || null,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
    phone: parsed.data.phone || null,
    is_default: !count,
  })

  if (error) return { error: "Could not save address." }

  revalidatePath("/account/addresses")
  return { success: true }
}

export async function deleteAddressAction(addressId: string) {
  const supabase = await createClient()
  await supabase.from("addresses").delete().eq("id", addressId)
  revalidatePath("/account/addresses")
}

export async function setDefaultAddressAction(addressId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id)
  await supabase.from("addresses").update({ is_default: true }).eq("id", addressId)
  revalidatePath("/account/addresses")
}
