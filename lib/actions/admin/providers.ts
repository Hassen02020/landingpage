"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { syncProviderCatalog, type CatalogSyncResult } from "@/lib/providers/syncCatalog"

export type SyncActionState = CatalogSyncResult

export async function runProviderSyncAction(tenantId: string, providerCode: string): Promise<SyncActionState> {
  const supabase = await createClient()
  const result = await syncProviderCatalog(supabase, tenantId, providerCode)
  revalidatePath("/admin/providers")
  return result
}
