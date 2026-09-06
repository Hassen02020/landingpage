"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createReviewAction, type ReviewActionState } from "@/lib/actions/reviews"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit Review"}
    </Button>
  )
}

export function ReviewForm({ productId }: { productId: string }) {
  const [state, formAction] = useFormState<ReviewActionState, FormData>(createReviewAction, undefined)

  if (state?.success) {
    return <p className="text-sm text-forest">Thanks! Your review has been submitted for approval.</p>
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="max-w-[140px]">
        <Label htmlFor="rating">Rating</Label>
        <Select id="rating" name="rating" defaultValue="5">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" />
      </div>
      <div>
        <Label htmlFor="body">Review</Label>
        <textarea
          id="body"
          name="body"
          rows={3}
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>
      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
