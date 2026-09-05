"use client"

import { useState, useTransition } from "react"
import { routeOrderAction } from "@/lib/actions/admin/order-routing"
import { Button } from "@/components/ui/Button"

export function RouteOrderButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-ink-500">{result}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null)
            const res = await routeOrderAction(orderId)
            setResult(
              res.success
                ? `Routed ${res.itemsRouted}, placed ${res.itemsPlaced}${res.itemsSkipped ? `, ${res.itemsSkipped} already done` : ""}`
                : res.error
            )
          })
        }
      >
        {isPending ? "Routing…" : "Route order"}
      </Button>
    </div>
  )
}
