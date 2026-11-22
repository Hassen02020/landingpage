"use client"

import { Analytics } from "@vercel/analytics/next"
import { cleanVisitUrl } from "@/lib/visit-counter"

/** Compteur de visites anonyme, sans cookie : voir lib/visit-counter.ts (adresse nettoyée, espace équipe exclu). */
export function VisitCounter() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = cleanVisitUrl(event.url)
        return url ? { ...event, url } : null
      }}
    />
  )
}
