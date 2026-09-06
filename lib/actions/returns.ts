"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { returnRequestSchema } from "@/lib/validations/return"
import { computeRemainingReturnable } from "@/lib/returns/remaining"

export type RequestReturnState = { error?: string } | undefined

/**
 * Creates a return request for one or more items on the customer's own
 * order. Enforces, server-side, that the requested quantity never exceeds
 * what's left to return on that line — the original order_item quantity
 * minus whatever's already been requested in a prior non-rejected return —
 * so the same unit can't be returned twice by submitting the form again.
 */
export async function requestReturnAction(_prevState: RequestReturnState, formData: FormData): Promise<RequestReturnState> {
  const raw = {
    orderId: formData.get("orderId"),
    reason: formData.get("reason") || undefined,
    items: JSON.parse(String(formData.get("items") || "[]")),
  }

  const parsed = returnRequestSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  const { orderId, reason, items } = parsed.data
  const requested = items.filter((i) => i.quantity > 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  const { data: order } = await supabase.from("orders").select("id, tenant_id, customer_id").eq("id", orderId).single()
  if (!order || order.customer_id !== user.id) return { error: "Order not found." }

  const orderItemIds = requested.map((i) => i.orderItemId)
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .in("id", orderItemIds)

  const { data: priorReturns } = await supabase
    .from("return_items")
    .select("order_item_id, quantity, returns!inner(order_id, status)")
    .in("order_item_id", orderItemIds)
    .neq("returns.status", "rejected")

  const alreadyRequested: Record<string, number> = {}
  for (const row of (priorReturns as any[]) ?? []) {
    alreadyRequested[row.order_item_id] = (alreadyRequested[row.order_item_id] ?? 0) + row.quantity
  }

  const remainingByItem = computeRemainingReturnable(orderItems ?? [], alreadyRequested)

  for (const line of requested) {
    const orderItem = orderItems?.find((oi) => oi.id === line.orderItemId)
    if (!orderItem) return { error: "One of the selected items doesn't belong to this order." }

    if (line.quantity > remainingByItem[line.orderItemId]) {
      return { error: `You can return at most ${remainingByItem[line.orderItemId]} more of one of the selected items.` }
    }
  }

  const { data: newReturn, error: returnError } = await supabase
    .from("returns")
    .insert({ tenant_id: order.tenant_id, order_id: orderId, customer_id: user.id, reason: reason ?? null })
    .select("id")
    .single()

  if (returnError || !newReturn) return { error: "Could not submit return request." }

  const { error: itemsError } = await supabase.from("return_items").insert(
    requested.map((line) => ({ return_id: newReturn.id, order_item_id: line.orderItemId, quantity: line.quantity }))
  )

  if (itemsError) return { error: "Could not submit return request." }

  revalidatePath(`/account/orders/${orderId}`)
  redirect(`/account/orders/${orderId}`)
}
