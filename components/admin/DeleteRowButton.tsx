"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"

export function DeleteRowButton({ onDelete, confirmMessage }: { onDelete: () => Promise<void> | void; confirmMessage?: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-label="Delete"
      disabled={isPending}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return
        startTransition(async () => {
          await onDelete()
        })
      }}
      className="text-ink-400 hover:text-coral-600 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  )
}
