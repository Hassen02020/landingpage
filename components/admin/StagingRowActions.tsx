"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { promoteStagingAction, rejectStagingAction } from "@/lib/actions/admin/catalog"

export function StagingRowActions({ stagingId, matchedProductId }: { stagingId: string; matchedProductId: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [promotedTo, setPromotedTo] = useState<string | null>(matchedProductId)

  if (promotedTo) {
    return (
      <Link href={`/admin/products/${promotedTo}`} className="text-xs font-medium text-forest hover:underline">
        View product
      </Link>
    )
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && <span className="text-xs text-coral-600">{error}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await promoteStagingAction(stagingId)
            if (res.success) setPromotedTo(res.productId)
            else setError(res.error)
          })
        }
        className="rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest hover:bg-forest-50 disabled:opacity-50"
      >
        Promote
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await rejectStagingAction(stagingId)
            if (!res.success) setError(res.error ?? "Could not reject.")
          })
        }
        className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}
