"use client"

import { useEffect } from "react"
import { trackViewContent } from "@/lib/analytics"

export function ProductViewTracker({ id, name, priceCents }: { id: string; name: string; priceCents: number }) {
  useEffect(() => {
    trackViewContent({ id, name, priceCents })
  }, [id, name, priceCents])

  return null
}
