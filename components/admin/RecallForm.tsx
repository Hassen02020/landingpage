"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createRecallAction, type AdminActionState } from "@/lib/actions/admin/recalls"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Issuing..." : "Issue Recall"}
    </Button>
  )
}

export function RecallForm({ variants }: { variants: { id: string; label: string }[] }) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(createRecallAction, undefined)

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
      <div>
        <Label htmlFor="lotNumber">Lot number (optional)</Label>
        <Input id="lotNumber" name="lotNumber" placeholder="Leave blank to recall every lot of this item" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select id="severity" name="severity" defaultValue="high">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="reason">Reason</Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          placeholder="e.g. Possible salmonella contamination"
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
