"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ToggleAutomationRuleState = { success: true } | { success: false; error: string }

export async function toggleAutomationRuleAction(
  tenantId: string,
  type: "pause_on_stockout" | "alert_on_sync_failure",
  enabled: boolean
): Promise<ToggleAutomationRuleState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("automation_rules")
    .update({ enabled })
    .eq("tenant_id", tenantId)
    .eq("type", type)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/automation")
  return { success: true }
}
