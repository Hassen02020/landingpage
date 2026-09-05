"use client"

import { useTransition } from "react"
import { setDefaultPricingRuleAction, deletePricingRuleAction } from "@/lib/actions/admin/pricing"

export function PricingRuleRowActions({ ruleId, tenantId, isDefault }: { ruleId: string; tenantId: string; isDefault: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-end gap-3">
      {!isDefault && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setDefaultPricingRuleAction(ruleId, tenantId)
            })
          }
          className="text-xs font-medium text-forest hover:underline disabled:opacity-50"
        >
          Set default
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm("Delete this pricing rule?")) startTransition(() => deletePricingRuleAction(ruleId))
        }}
        className="text-xs font-medium text-coral-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
