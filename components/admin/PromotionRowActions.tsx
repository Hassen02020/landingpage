"use client"

import { useTransition } from "react"
import { togglePromotionAction, deletePromotionAction } from "@/lib/actions/admin/promotions"
import { DeleteRowButton } from "@/components/admin/DeleteRowButton"

export function PromotionRowActions({ promotionId, isActive }: { promotionId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => togglePromotionAction(promotionId, !isActive))}
        className="text-xs font-medium text-forest hover:underline disabled:opacity-50"
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
      <DeleteRowButton confirmMessage="Delete this promotion?" onDelete={() => deletePromotionAction(promotionId)} />
    </div>
  )
}
