"use client"

import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { requestReturnAction, type RequestReturnState } from "@/lib/actions/returns"
import { Input, Label } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import type { ReturnableItem } from "@/lib/data/returns"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit Return Request"}
    </Button>
  )
}

export function ReturnRequestForm({ orderId, items }: { orderId: string; items: ReturnableItem[] }) {
  const [state, formAction] = useFormState<RequestReturnState, FormData>(requestReturnAction, undefined)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((item) => ({ orderItemId: item.id, quantity: quantities[item.id] ?? 0 })))}
      />

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-ink-100 p-3">
            <div>
              <p className="text-sm font-medium text-ink">
                {item.productName}
                {item.variantLabel ? ` — ${item.variantLabel}` : ""}
              </p>
              <p className="text-xs text-ink-400">
                {item.remaining > 0 ? `${item.remaining} eligible to return` : "Already fully returned"}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={item.remaining}
              defaultValue={0}
              disabled={item.remaining === 0}
              className="w-20"
              onChange={(e) => {
                const value = Math.max(0, Math.min(item.remaining, Number(e.target.value) || 0))
                setQuantities((q) => ({ ...q, [item.id]: value }))
              }}
            />
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="reason">Reason (optional)</Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Why are you returning this?"
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
