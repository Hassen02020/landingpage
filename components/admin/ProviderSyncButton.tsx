"use client"

import { useState, useTransition } from "react"
import { runProviderSyncAction } from "@/lib/actions/admin/providers"
import { Button } from "@/components/ui/Button"

export function ProviderSyncButton({ tenantId, providerCode }: { tenantId: string; providerCode: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="flex items-center justify-end gap-3">
      {result && <span className="text-xs text-ink-500">{result}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null)
            const res = await runProviderSyncAction(tenantId, providerCode)
            setResult(res.success ? `Fetched ${res.itemsFetched}, staged ${res.itemsStaged}` : res.error)
          })
        }
      >
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  )
}
