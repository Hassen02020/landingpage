"use client"

import { useEffect } from "react"
import { trackPurchase } from "@/lib/analytics"

export function PurchaseTracker({
  orderId,
  valueCents,
  items,
}: {
  orderId: string
  valueCents: number
  items: { productName: string; totalCents: number; quantity: number }[]
}) {
  useEffect(() => {
    trackPurchase(
      orderId,
      valueCents,
      items.map((i, idx) => ({
        id: `${orderId}-${idx}`,
        name: i.productName,
        priceCents: i.totalCents / i.quantity,
        quantity: i.quantity,
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
