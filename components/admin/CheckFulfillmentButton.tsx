"use client"

import { useState, useTransition } from "react"
import { checkFulfillmentAction } from "@/lib/actions/admin/fulfillment"
import { Button } from "@/components/ui/Button"

export function CheckFulfillmentButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-ink-500">{result}</span>}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null)
            const res = await checkFulfillmentAction(orderId)
            setResult(res.success ? `Checked ${res.itemsChecked}` : res.error)
          })
        }
      >
        {isPending ? "Checking…" : "Check fulfillment"}
      </Button>
    </div>
  )
}
