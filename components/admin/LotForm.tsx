"use client"

import { useFormState, useFormStatus } from "react-dom"
import { receiveLotAction, type AdminActionState } from "@/lib/actions/admin/lots"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Receive Lot"}
    </Button>
  )
}

export function LotForm({ variants }: { variants: { id: string; label: string }[] }) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(receiveLotAction, undefined)

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
      <div>
        <Label htmlFor="variantId">Item</Label>
        <Select id="variantId" name="variantId" required defaultValue="">
          <option value="" disabled>
            Select an item
          </option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lotNumber">Lot number</Label>
          <Input id="lotNumber" name="lotNumber" placeholder="LOT-2026-0913" required />
        </div>
        <div>
          <Label htmlFor="quantityReceived">Quantity received</Label>
          <Input id="quantityReceived" name="quantityReceived" type="number" min="1" defaultValue={1} required />
        </div>
      </div>
      <div>
        <Label htmlFor="expiryDate">Expiry date (optional)</Label>
        <Input id="expiryDate" name="expiryDate" type="date" />
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
