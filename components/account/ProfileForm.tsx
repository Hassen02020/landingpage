"use client"

import { useFormState, useFormStatus } from "react-dom"
import { updateProfileAction, type ProfileActionState } from "@/lib/actions/profile"
import { Input, Label } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  )
}

export function ProfileForm({
  email,
  fullName,
  phone,
}: {
  email: string
  fullName: string | null
  phone: string | null
}) {
  const [state, formAction] = useFormState<ProfileActionState, FormData>(updateProfileAction, undefined)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName ?? ""} required />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} />
      </div>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-forest">Profile updated.</p>}

      <SubmitButton />
    </form>
  )
}
