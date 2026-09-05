"use client"

import { useTransition } from "react"
import { X } from "lucide-react"
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/actions/addresses"
import { Badge } from "@/components/ui/Badge"

export type AddressData = {
  id: string
  label: string | null
  fullName: string
  line1: string
  line2: string | null
  city: string
  state: string
  postalCode: string
  isDefault: boolean
}

export function AddressCard({ address }: { address: AddressData }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-start justify-between rounded-xl border border-ink-100 bg-white p-4">
      <div className="text-sm">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{address.label || address.fullName}</p>
          {address.isDefault && <Badge variant="forest">Default</Badge>}
        </div>
        <p className="text-ink-600">{address.fullName}</p>
        <p className="text-ink-600">
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}
        </p>
        <p className="text-ink-600">
          {address.city}, {address.state} {address.postalCode}
        </p>
        {!address.isDefault && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => setDefaultAddressAction(address.id))}
            className="mt-2 text-xs font-medium text-forest hover:underline"
          >
            Set as default
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Remove address"
        disabled={isPending}
        onClick={() => startTransition(() => deleteAddressAction(address.id))}
        className="text-ink-400 hover:text-coral-600"
      >
        <X size={16} />
      </button>
    </div>
  )
}
