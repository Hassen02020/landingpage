"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createPromotionAction, type AdminActionState } from "@/lib/actions/admin/promotions"
import { Input, Label } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add Promotion"}
    </Button>
  )
}

export function PromotionForm() {
  const [state, formAction] = useFormState<AdminActionState, FormData>(createPromotionAction, undefined)

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="30% Off Your First Order" required />
      </div>
      <div>
        <Label htmlFor="badgeText">Badge Text</Label>
        <Input id="badgeText" name="badgeText" placeholder="30% OFF" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input id="subtitle" name="subtitle" />
      </div>
      <div>
        <Label htmlFor="ctaLabel">CTA Label</Label>
        <Input id="ctaLabel" name="ctaLabel" placeholder="Shop Now" />
      </div>
      <div>
        <Label htmlFor="ctaHref">CTA Link</Label>
        <Input id="ctaHref" name="ctaHref" placeholder="/deals" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked />
        Active
      </label>

      {state?.error && <p className="sm:col-span-2 text-sm text-coral-600">{state.error}</p>}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  )
}
