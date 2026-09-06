"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function ProductGallery({ images, alt }: { images: { url: string; alt: string | null }[]; alt: string }) {
  const [active, setActive] = useState(0)
  const shown = images.length > 0 ? images : [{ url: "", alt }]

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-sand-100">
        {shown[active]?.url && (
          <Image
            src={shown[active].url}
            alt={shown[active].alt ?? alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        )}
      </div>
      {shown.length > 1 && (
        <div className="mt-3 flex gap-2">
          {shown.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2",
                i === active ? "border-forest" : "border-transparent"
              )}
            >
              {img.url && <Image src={img.url} alt={img.alt ?? alt} fill sizes="64px" className="object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
