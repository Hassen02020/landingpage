"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { captureAttribution } from "@/lib/attribution"

// Enregistre la source de la visite (UTM, fbclid, ttclid…) à chaque page vue.
export function AttributionTracker() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      captureAttribution()
    } catch {
      /* ignore */
    }
  }, [pathname])
  return null
}
