"use client"

import { useFormState, useFormStatus } from "react-dom"
import type { AdminActionState } from "@/lib/actions/admin/categories"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  )
}

export function CategoryForm({
  action,
  defaultValues,
  submitLabel = "Create Category",
}: {
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>
  defaultValues?: { name: string; petType: string; imageUrl: string | null; isActive: boolean }
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
        <Label htmlFor="petType">Pet Type</Label>
        <Select id="petType" name="petType" defaultValue={defaultValues?.petType ?? "both"}>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
          <option value="both">Both</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="imageUrl">Image URL (optional)</Label>
        <Input id="imageUrl" name="imageUrl" defaultValue={defaultValues?.imageUrl ?? ""} />
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
