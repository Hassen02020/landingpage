"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export type ReturnActionState = { success: boolean; error?: string }

function revalidateReturn(orderId: string) {
  revalidatePath("/admin/returns")
  revalidatePath(`/account/orders/${orderId}`)
}

export async function approveReturnAction(returnId: string): Promise<ReturnActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: ret, error } = await supabase
    .from("returns")
    .update({ status: "approved", resolved_by: user?.id ?? null })
    .eq("id", returnId)
    .eq("status", "requested")
    .select("order_id")
    .single()

  if (error || !ret) return { success: false, error: "Could not approve return." }
  revalidateReturn(ret.order_id)
  return { success: true }
}

export async function rejectReturnAction(returnId: string): Promise<ReturnActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: ret, error } = await supabase
    .from("returns")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq("id", returnId)
    .in("status", ["requested", "approved"])
    .select("order_id")
    .single()

  if (error || !ret) return { success: false, error: "Could not reject return." }
  revalidateReturn(ret.order_id)
  return { success: true }
}

/**
 * Marks a return's items as physically back in the warehouse and restocks
 * inventory via Phase 12's apply_inventory_delta — the same atomic,
 * tenant-checked RPC the provider inventory sync uses, reused as-is
 * rather than reimplementing a second "add stock back" code path.
 */
export async function receiveReturnAction(returnId: string): Promise<ReturnActionState> {
  const supabase = await createClient()

  const { data: ret } = await supabase.from("returns").select("id, order_id, status").eq("id", returnId).single()
  if (!ret) return { success: false, error: "Return not found." }
  if (ret.status !== "approved") return { success: false, error: "Return must be approved first." }

  const { data: items } = await supabase
    .from("return_items")
    .select("quantity, order_items(variant_id)")
    .eq("return_id", returnId)

  for (const item of (items as any[]) ?? []) {
    const variantId = item.order_items?.variant_id
    if (variantId) {
      await supabase.rpc("apply_inventory_delta", { p_variant_id: variantId, p_delta: item.quantity })
    }
  }

  const { error } = await supabase.from("returns").update({ status: "received" }).eq("id", returnId)
  if (error) return { success: false, error: "Could not mark return received." }

  revalidateReturn(ret.order_id)
  return { success: true }
}

/**
 * Initiates the Stripe refund for a received return. Only ever *initiates*
 * it — confirmation comes back through the existing charge.refunded
 * webhook (handleChargeRefunded), which is what actually writes the
 * `refunds` table row. If Stripe isn't configured or the API call fails,
 * the return is marked 'refund_failed' with the real error, never
 * silently marked as succeeded.
 */
export async function refundReturnAction(returnId: string): Promise<ReturnActionState> {
  const supabase = await createClient()

  const { data: ret } = await supabase.from("returns").select("id, order_id, status").eq("id", returnId).single()
  if (!ret) return { success: false, error: "Return not found." }
  if (ret.status !== "received") return { success: false, error: "Return must be marked received first." }

  const { data: order } = await supabase
    .from("orders")
    .select("stripe_payment_intent_id")
    .eq("id", ret.order_id)
    .single()

  if (!order?.stripe_payment_intent_id) {
    await supabase.from("returns").update({ status: "refund_failed", refund_error: "Order has no Stripe payment." }).eq("id", returnId)
    return { success: false, error: "This order has no Stripe payment to refund." }
  }

  const { data: items } = await supabase
    .from("return_items")
    .select("quantity, order_items(unit_price_cents)")
    .eq("return_id", returnId)

  const amountCents = ((items as any[]) ?? []).reduce((sum, i) => sum + i.quantity * (i.order_items?.unit_price_cents ?? 0), 0)

  if (amountCents <= 0) return { success: false, error: "Nothing to refund." }

  try {
    const stripe = getStripe()
    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id, amount: amountCents })

    await supabase
      .from("returns")
      .update({ status: "refund_initiated", refund_amount_cents: amountCents, resolved_at: new Date().toISOString() })
      .eq("id", returnId)

    revalidateReturn(ret.order_id)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error."
    await supabase.from("returns").update({ status: "refund_failed", refund_error: message }).eq("id", returnId)
    revalidateReturn(ret.order_id)
    return { success: false, error: message }
  }
}
