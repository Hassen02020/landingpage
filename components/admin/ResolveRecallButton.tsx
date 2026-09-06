"use client"

import { useTransition } from "react"
import { resolveRecallAction } from "@/lib/actions/admin/recalls"

export function ResolveRecallButton({ recallId }: { recallId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await resolveRecallAction(recallId)
        })
      }
      className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
    >
      Mark resolved
    </button>
  )
}
