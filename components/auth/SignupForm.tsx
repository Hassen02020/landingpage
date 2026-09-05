"use client"

import { useFormState, useFormStatus } from "react-dom"
import { signUpAction, type AuthActionState } from "@/lib/actions/auth"
import { Input, Label } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account..." : "Create Account"}
    </Button>
  )
}

export function SignupForm() {
  const [state, formAction] = useFormState<AuthActionState, FormData>(signUpAction, undefined)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
