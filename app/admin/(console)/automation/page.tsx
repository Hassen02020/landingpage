import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { AutomationRuleToggle } from "@/components/admin/AutomationRuleToggle"

export const metadata: Metadata = { title: "Automation" }

const RULE_COPY: Record<string, { label: string; description: string }> = {
  pause_on_stockout: {
    label: "Pause products on stockout",
    description: "Archives a product automatically once every one of its variants reaches zero available stock.",
  },
  alert_on_sync_failure: {
    label: "Alert on sync failure",
    description:
      "Logs a run below whenever a provider catalog or inventory sync fails during the cron pass, so a staffer can act on it — there's no email/SMS integration in this project, so \"alert\" means visible here, not sent anywhere.",
  },
}

const RUN_TYPE_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  cron_pass: "outline",
  pause_on_stockout: "sand",
  alert_on_sync_failure: "coral",
}

export default async function AdminAutomationPage() {
  const supabase = await createClient()

  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", "petora").single()
  const tenantId = tenant?.id

  const [{ data: rules }, { data: runs }] = await Promise.all([
    tenantId
      ? supabase.from("automation_rules").select("type, enabled").eq("tenant_id", tenantId)
      : Promise.resolve({ data: [] as { type: string; enabled: boolean }[] }),
    tenantId
      ? supabase
          .from("automation_runs")
          .select("id, rule_type, triggered_by, items_affected, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const ruleByType = new Map((rules ?? []).map((r) => [r.type, r.enabled]))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Automation</h1>
        <p className="mt-1 text-sm text-ink-500">
          A Vercel Cron job (Commerce OS Phase 18) runs the provider catalog sync, inventory sync, and fulfillment check
          from Phases 9/12/14 automatically on a schedule, then applies whichever of these rules a tenant has opted into.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
        {Object.entries(RULE_COPY).map(([type, copy], i) => (
          <div
            key={type}
            className={`flex items-start justify-between gap-6 p-4 ${i > 0 ? "border-t border-ink-50" : ""}`}
          >
            <div>
              <p className="font-medium text-ink">{copy.label}</p>
              <p className="mt-1 text-sm text-ink-500">{copy.description}</p>
            </div>
            {tenantId && (
              <AutomationRuleToggle tenantId={tenantId} type={type as "pause_on_stockout" | "alert_on_sync_failure"} initialEnabled={ruleByType.get(type) ?? false} />
            )}
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-ink">Recent runs</h2>
        <p className="mt-1 text-sm text-ink-500">Every cron pass logs a summary here, plus one entry per rule it triggered.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Triggered by</th>
                <th className="px-4 py-3 text-right">Items affected</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Badge variant={RUN_TYPE_VARIANT[run.rule_type] ?? "outline"} className="capitalize">
                      {run.rule_type.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600 capitalize">{run.triggered_by}</td>
                  <td className="px-4 py-3 text-right text-ink-700">{run.items_affected}</td>
                  <td className="px-4 py-3 text-ink-500">{new Date(run.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                    No automation runs yet — the cron job hasn&apos;t fired.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
