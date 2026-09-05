"use client"

import { useFormState, useFormStatus } from "react-dom"
import type { AdminActionState } from "@/lib/actions/admin/brands"
import { Input, Label } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  )
}

export function BrandForm({
  action,
  defaultValues,
  submitLabel = "Create Brand",
}: {
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>
  defaultValues?: { name: string; description: string | null; logoUrl: string | null; isActive: boolean }
  submitLabel?: string
}) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(action, undefined)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" defaultValue={defaultValues?.description ?? ""} />
      </div>
      <div>
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input id="logoUrl" name="logoUrl" defaultValue={defaultValues?.logoUrl ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
        Active
      </label>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  )
}
