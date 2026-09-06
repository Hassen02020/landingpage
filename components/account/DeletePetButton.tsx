"use client"

import { useTransition } from "react"
import { X } from "lucide-react"
import { deletePetAction } from "@/lib/actions/pets"

export function DeletePetButton({ petId }: { petId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-label="Remove pet"
      disabled={isPending}
      onClick={() => startTransition(() => deletePetAction(petId))}
      className="text-ink-400 hover:text-coral-600"
    >
      <X size={16} />
    </button>
  )
}
