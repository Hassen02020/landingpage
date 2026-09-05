"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createCheckoutSessionAction, type CheckoutActionState } from "@/lib/actions/checkout"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { US_STATES } from "@/lib/validations/checkout"
import { trackAddPaymentInfo } from "@/lib/analytics"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Redirecting to payment..." : "Continue to Payment"}
    </Button>
  )
}

export function CheckoutForm({ defaultEmail, totalCents }: { defaultEmail?: string; totalCents: number }) {
  const [state, formAction] = useFormState<CheckoutActionState, FormData>(createCheckoutSessionAction, undefined)

  return (
    <form action={formAction} onSubmit={() => trackAddPaymentInfo(totalCents)} className="space-y-6">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Customer</h2>
        <div className="mt-3">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultEmail} required />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Shipping Address</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div>
            <Label htmlFor="line1">Address</Label>
            <Input id="line1" name="line1" required />
          </div>
          <div>
            <Label htmlFor="line2">Apt, suite, etc. (optional)</Label>
            <Input id="line2" name="line2" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required />
            </div>
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
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Delivery</h2>
        <div className="mt-3 space-y-2">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-sm has-[:checked]:border-forest">
            <span className="flex items-center gap-2">
              <input type="radio" name="shippingMethod" value="standard" defaultChecked />
              Standard Shipping (3-5 business days)
            </span>
            <span className="text-ink-500">Free over $49</span>
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-sm has-[:checked]:border-forest">
            <span className="flex items-center gap-2">
              <input type="radio" name="shippingMethod" value="express" />
              Express Shipping (1-2 business days)
            </span>
            <span className="text-ink-500">$14.99</span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Coupon</h2>
        <div className="mt-3">
          <Label htmlFor="couponCode">Coupon Code (optional)</Label>
          <Input id="couponCode" name="couponCode" placeholder="WELCOME30" className="uppercase" />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Payment</h2>
        <p className="mt-2 text-sm text-ink-500">
          You&apos;ll enter your card, Apple Pay, or Google Pay details securely on the next step. PETORA never
          stores your payment details.
        </p>
      </section>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
