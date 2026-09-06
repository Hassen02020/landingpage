"use client"

import { useState, useTransition } from "react"
import { changePlanAction, createBillingPortalSessionAction } from "@/lib/actions/admin/billing"
import { Button } from "@/components/ui/Button"

export function PlanActions({ tenantId, currentPlanCode }: { tenantId: string; currentPlanCode: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {currentPlanCode !== "starter" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setMessage(null)
                const res = await changePlanAction(tenantId, "starter")
                setMessage(res.success ? "Downgraded to Starter." : res.error)
              })
            }
          >
            Downgrade to Starter
          </Button>
        )}
        {currentPlanCode !== "scale" && (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setMessage(null)
                const res = await changePlanAction(tenantId, currentPlanCode === "starter" ? "growth" : "scale")
                setMessage(res.success ? "Plan updated." : res.error)
              })
            }
          >
            Upgrade
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null)
              const res = await createBillingPortalSessionAction(tenantId)
              setMessage(res.success ? "Redirecting…" : res.error)
              if (res.success) window.location.href = res.url
            })
          }
        >
          Manage billing
        </Button>
      </div>
      {message && <p className="max-w-xs text-right text-xs text-ink-500">{message}</p>}
    </div>
  )
}
