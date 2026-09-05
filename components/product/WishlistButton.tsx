"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { addToWishlistAction } from "@/lib/actions/wishlist"

export function WishlistButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <button
      type="button"
      aria-label="Add to wishlist"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await addToWishlistAction(productId)
          if (result.success) setSaved(true)
        })
      }}
      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-500 hover:text-coral"
    >
      <Heart size={16} className={saved ? "fill-coral text-coral" : ""} />
    </button>
  )
}
