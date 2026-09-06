"use client"

import { useTransition } from "react"
import { updateOrderStatusAction } from "@/lib/actions/admin/orders"
import { Select } from "@/components/ui/Select"

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => {
        const newStatus = e.target.value
        startTransition(async () => {
          await updateOrderStatusAction(orderId, newStatus)
        })
      }}
      className="w-auto"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="capitalize">
          {s}
        </option>
      ))}
    </Select>
  )
}
