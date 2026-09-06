"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { checkFulfillmentForOrder, type FulfillmentCheckResult } from "@/lib/providers/checkFulfillment"

export type CheckFulfillmentState = FulfillmentCheckResult

export async function checkFulfillmentAction(orderId: string): Promise<CheckFulfillmentState> {
  const supabase = await createClient()
  const result = await checkFulfillmentForOrder(supabase, orderId)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/account/orders/${orderId}`)
  return result
}
