"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createPetAction, type PetActionState } from "@/lib/actions/pets"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add Pet"}
    </Button>
  )
}

export function PetForm() {
  const [state, formAction] = useFormState<PetActionState, FormData>(createPetAction, undefined)

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="species">Type</Label>
        <Select id="species" name="species" defaultValue="dog">
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="breed">Breed (optional)</Label>
        <Input id="breed" name="breed" />
      </div>
      <div>
        <Label htmlFor="weightLbs">Weight (lbs)</Label>
        <Input id="weightLbs" name="weightLbs" type="number" min="0" step="0.1" />
      </div>
      <div>
        <Label htmlFor="lifeStage">Life Stage</Label>
        <Select id="lifeStage" name="lifeStage" defaultValue="adult">
          <option value="puppy_kitten">Puppy / Kitten</option>
          <option value="adult">Adult</option>
          <option value="senior">Senior</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="activityLevel">Activity Level</Label>
        <Select id="activityLevel" name="activityLevel" defaultValue="moderate">
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="budget">Budget</Label>
        <Select id="budget" name="budget" defaultValue="standard">
          <option value="value">Value</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="allergies">Allergies (comma separated)</Label>
        <Input id="allergies" name="allergies" placeholder="chicken, grain" />
      </div>

      {state?.error && <p className="sm:col-span-2 text-sm text-coral-600">{state.error}</p>}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  )
}
