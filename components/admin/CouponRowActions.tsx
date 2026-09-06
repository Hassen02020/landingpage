"use client"

import { useTransition } from "react"
import { toggleCouponAction, deleteCouponAction } from "@/lib/actions/admin/coupons"
import { DeleteRowButton } from "@/components/admin/DeleteRowButton"

export function CouponRowActions({ couponId, isActive }: { couponId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => toggleCouponAction(couponId, !isActive))}
        className="text-xs font-medium text-forest hover:underline disabled:opacity-50"
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
      <DeleteRowButton confirmMessage="Delete this coupon?" onDelete={() => deleteCouponAction(couponId)} />
    </div>
  )
}
