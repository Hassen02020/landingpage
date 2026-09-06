"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createPricingRuleAction, type AdminActionState } from "@/lib/actions/admin/pricing"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Create Rule"}
    </Button>
  )
}

export function PricingRuleForm({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(createPricingRuleAction, undefined)

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Standard markup" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="markupType">Markup type</Label>
          <Select id="markupType" name="markupType" defaultValue="percentage">
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed amount (cents)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="markupValue">Markup value</Label>
          <Input id="markupValue" name="markupValue" type="number" min="0" step="0.01" defaultValue={40} />
        </div>
      </div>
      <div>
        <Label htmlFor="minMarginCents">Minimum margin (cents)</Label>
        <Input id="minMarginCents" name="minMarginCents" type="number" min="0" defaultValue={500} />
        <p className="mt-1 text-xs text-ink-500">
          Hard floor over the markup — the computed price never lands below cost + this amount, even if the markup alone
          would.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isDefault" defaultChecked />
        Make this the default rule (applied automatically when promoting a staged listing)
      </label>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
