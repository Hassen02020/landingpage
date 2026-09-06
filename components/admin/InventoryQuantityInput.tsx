"use client"

import { useState, useTransition } from "react"
import { updateInventoryAction } from "@/lib/actions/admin/inventory"
import { Input } from "@/components/ui/Input"

export function InventoryQuantityInput({ variantId, initialQuantity }: { variantId: string; initialQuantity: number }) {
  const [value, setValue] = useState(initialQuantity)
  const [isPending, startTransition] = useTransition()

  return (
    <Input
      type="number"
      min="0"
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(Number(e.target.value))}
      onBlur={() =>
        startTransition(async () => {
          await updateInventoryAction(variantId, value)
        })
      }
      className="h-9 w-24"
    />
  )
}
