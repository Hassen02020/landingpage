"use client"

import { useState, useTransition } from "react"
import { approveReturnAction, rejectReturnAction, receiveReturnAction, refundReturnAction } from "@/lib/actions/admin/returns"

export function ReturnRowActions({ returnId, status }: { returnId: string; status: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (action: (id: string) => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      setError(null)
      const res = await action(returnId)
      if (!res.success) setError(res.error ?? "Something went wrong.")
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-coral-600">{error}</span>}
      {status === "requested" && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(approveReturnAction)}
            className="rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest hover:bg-forest-50 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(rejectReturnAction)}
            className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
      {status === "approved" && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(receiveReturnAction)}
            className="rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest hover:bg-forest-50 disabled:opacity-50"
          >
            Mark received
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(rejectReturnAction)}
            className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
      {status === "received" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(refundReturnAction)}
          className="rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest hover:bg-forest-50 disabled:opacity-50"
        >
          Refund
        </button>
      )}
      {status === "refund_failed" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(refundReturnAction)}
          className="rounded-full border border-coral-300 px-3 py-1 text-xs font-medium text-coral-600 hover:bg-coral-50 disabled:opacity-50"
        >
          Retry refund
        </button>
      )}
      {["rejected", "refund_initiated", "refunded"].includes(status) && <span className="text-xs text-ink-400">—</span>}
    </div>
  )
}
