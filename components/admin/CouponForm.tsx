"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createCouponAction, type AdminActionState } from "@/lib/actions/admin/coupons"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Create Coupon"}
    </Button>
  )
}

export function CouponForm() {
  const [state, formAction] = useFormState<AdminActionState, FormData>(createCouponAction, undefined)

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
      <div>
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" placeholder="WELCOME30" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="percentage">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
            <option value="free_shipping">Free Shipping</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Value</Label>
          <Input id="value" name="value" type="number" min="0" step="0.01" defaultValue={0} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="minOrderCents">Minimum Order (cents)</Label>
          <Input id="minOrderCents" name="minOrderCents" type="number" min="0" defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="usageLimit">Usage Limit (optional)</Label>
          <Input id="usageLimit" name="usageLimit" type="number" min="0" />
        </div>
      </div>
      <div>
        <Label htmlFor="expiresAt">Expires At (optional)</Label>
        <Input id="expiresAt" name="expiresAt" type="date" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="firstOrderOnly" />
        First order only
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isActive" defaultChecked />
        Active
      </label>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
