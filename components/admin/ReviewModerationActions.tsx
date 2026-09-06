"use client"

import { useTransition } from "react"
import { Check, X } from "lucide-react"
import { moderateReviewAction } from "@/lib/actions/admin/reviews"

export function ReviewModerationActions({ reviewId }: { reviewId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await moderateReviewAction(reviewId, "approved")
          })
        }
        className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-white hover:bg-forest-700 disabled:opacity-50"
        aria-label="Approve review"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await moderateReviewAction(reviewId, "rejected")
          })
        }
        className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 hover:bg-coral hover:text-white disabled:opacity-50"
        aria-label="Reject review"
      >
        <X size={14} />
      </button>
    </div>
  )
}
