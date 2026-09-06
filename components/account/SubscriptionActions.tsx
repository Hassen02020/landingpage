"use client"

import { useTransition } from "react"
import { pauseSubscriptionAction, resumeSubscriptionAction, cancelSubscriptionAction } from "@/lib/actions/subscriptions"
import { Button } from "@/components/ui/Button"

export function SubscriptionActions({ subscriptionId, status }: { subscriptionId: string; status: string }) {
  const [isPending, startTransition] = useTransition()

  if (status === "cancelled") return null

  return (
    <div className="flex gap-2">
      {status === "active" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(async () => { await pauseSubscriptionAction(subscriptionId) })}
        >
          Pause
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(async () => { await resumeSubscriptionAction(subscriptionId) })}
        >
          Resume
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Cancel this Autoship subscription?")) return
          startTransition(async () => { await cancelSubscriptionAction(subscriptionId) })
        }}
        className="text-coral-600 hover:bg-coral-50"
      >
        Cancel
      </Button>
    </div>
  )
}
