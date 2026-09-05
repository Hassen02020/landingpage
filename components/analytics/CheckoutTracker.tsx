"use client"

import { useEffect } from "react"
import { trackInitiateCheckout } from "@/lib/analytics"

export function CheckoutTracker({
  items,
  valueCents,
}: {
  items: { id: string; name: string; priceCents: number; quantity: number }[]
  valueCents: number
}) {
  useEffect(() => {
    trackInitiateCheckout(items, valueCents)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
