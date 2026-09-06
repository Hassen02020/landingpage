"use client"

import { useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, X } from "lucide-react"
import { updateCartItemQuantityAction, removeCartItemAction } from "@/lib/actions/cart"
import { formatPrice } from "@/lib/utils"
import type { CartItemData } from "@/lib/data/cart"

export function CartItemRow({ item }: { item: CartItemData }) {
  const [isPending, startTransition] = useTransition()

  function setQuantity(quantity: number) {
    startTransition(async () => {
      await updateCartItemQuantityAction(item.id, quantity)
    })
  }

  function remove() {
    startTransition(async () => {
      await removeCartItemAction(item.id)
    })
  }

  return (
    <div className="flex gap-4 border-b border-ink-100 py-4 last:border-0">
      <Link href={`/product/${item.productSlug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand-100">
        {item.imageUrl && <Image src={item.imageUrl} alt={item.productName} fill sizes="80px" className="object-cover" />}
      </Link>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/product/${item.productSlug}`} className="text-sm font-medium text-ink hover:underline">
              {item.productName}
            </Link>
            {item.variantLabel && <p className="text-xs text-ink-500">{item.variantLabel}</p>}
            {!item.inStock && <p className="mt-1 text-xs font-medium text-coral-600">Out of stock</p>}
          </div>
          <button type="button" onClick={remove} aria-label="Remove item" className="text-ink-400 hover:text-coral-600">
            <X size={16} />
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center rounded-full border border-ink-200">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={isPending}
              onClick={() => setQuantity(item.quantity - 1)}
              className="flex h-8 w-8 items-center justify-center text-ink-600"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={isPending}
              onClick={() => setQuantity(item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center text-ink-600"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-sm font-semibold text-ink">{formatPrice(item.unitPriceCents * item.quantity)}</span>
        </div>
      </div>
    </div>
  )
}
