"use client"

import { useState, useTransition } from "react"
import { toggleAutomationRuleAction } from "@/lib/actions/admin/automation"

export function AutomationRuleToggle({
  tenantId,
  type,
  initialEnabled,
}: {
  tenantId: string
  type: "pause_on_stockout" | "alert_on_sync_failure"
  initialEnabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={() => {
          const next = !enabled
          setEnabled(next)
          setError(null)
          startTransition(async () => {
            const res = await toggleAutomationRuleAction(tenantId, type, next)
            if (!res.success) {
              setEnabled(!next)
              setError(res.error)
            }
          })
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          enabled ? "bg-forest" : "bg-ink-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-ink-600">{enabled ? "On" : "Off"}</span>
      {error && <span className="text-xs text-coral-600">{error}</span>}
    </div>
  )
}
