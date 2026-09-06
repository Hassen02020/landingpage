"use client"

import { useState, useTransition } from "react"
import { runInventorySyncAction } from "@/lib/actions/admin/inventory-sync"
import { Button } from "@/components/ui/Button"

export function InventorySyncButton({ tenantId, providerCode }: { tenantId: string; providerCode: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="flex items-center justify-end gap-3">
      {result && <span className="text-xs text-ink-500">{result}</span>}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null)
            const res = await runInventorySyncAction(tenantId, providerCode)
            setResult(res.success ? `Checked ${res.itemsChecked}, adjusted ${res.itemsAdjusted}` : res.error)
          })
        }
      >
        {isPending ? "Checking…" : "Sync stock"}
      </Button>
    </div>
  )
}
