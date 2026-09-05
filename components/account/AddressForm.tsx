"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createAddressAction, type AddressActionState } from "@/lib/actions/addresses"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { US_STATES } from "@/lib/validations/checkout"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add Address"}
    </Button>
  )
}

export function AddressForm() {
  const [state, formAction] = useFormState<AddressActionState, FormData>(createAddressAction, undefined)

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="label">Label (optional)</Label>
        <Input id="label" name="label" placeholder="Home" />
      </div>
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="line1">Address</Label>
        <Input id="line1" name="line1" required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="line2">Apt, suite, etc. (optional)</Label>
        <Input id="line2" name="line2" />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="state">State</Label>
          <Select id="state" name="state" defaultValue="" required>
            <option value="" disabled>
              Select
            </option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="postalCode">ZIP code</Label>
          <Input id="postalCode" name="postalCode" required />
        </div>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" />
      </div>

      {state?.error && <p className="sm:col-span-2 text-sm text-coral-600">{state.error}</p>}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  )
}
