"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { syncProviderInventory, type InventorySyncResult } from "@/lib/providers/syncInventory"

export type InventorySyncState = InventorySyncResult

export async function runInventorySyncAction(tenantId: string, providerCode: string): Promise<InventorySyncState> {
  const supabase = await createClient()
  const result = await syncProviderInventory(supabase, tenantId, providerCode)
  revalidatePath("/admin/providers")
  revalidatePath("/admin/inventory")
  return result
}
