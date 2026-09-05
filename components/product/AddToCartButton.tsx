"use client"

import { useState, useTransition } from "react"
import { ShoppingBag, Check } from "lucide-react"
import { addToCartAction } from "@/lib/actions/cart"
import { trackAddToCart } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export function AddToCartButton({
  variantId,
  quantity = 1,
  className,
  label,
  trackingItem,
}: {
  variantId: string | null
  quantity?: number
  className?: string
  label?: string
  trackingItem?: { name: string; priceCents: number }
}) {
  const [isPending, startTransition] = useTransition()
  const [justAdded, setJustAdded] = useState(false)

  if (!variantId) return null

  const handleClick = () => {
    startTransition(async () => {
      const result = await addToCartAction(variantId, quantity)
      if (result.success) {
        setJustAdded(true)
        setTimeout(() => setJustAdded(false), 1500)
        if (trackingItem) {
          trackAddToCart({ id: variantId, name: trackingItem.name, priceCents: trackingItem.priceCents, quantity })
        }
      }
    })
  }

  if (label) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-medium text-white transition-colors hover:bg-forest-700 disabled:opacity-60",
          className
        )}
      >
        {justAdded ? <Check size={16} /> : <ShoppingBag size={16} />}
        {justAdded ? "Added" : label}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label="Add to cart"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-forest text-white transition-colors hover:bg-forest-700 disabled:opacity-60",
        className
      )}
    >
      {justAdded ? <Check size={16} /> : <ShoppingBag size={16} />}
    </button>
  )
}
