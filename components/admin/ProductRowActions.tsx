"use client"

import { deleteProductAction } from "@/lib/actions/admin/products"
import { DeleteRowButton } from "@/components/admin/DeleteRowButton"

export function ProductRowActions({ productId }: { productId: string }) {
  return (
    <DeleteRowButton
      confirmMessage="Delete this product? This cannot be undone."
      onDelete={() => deleteProductAction(productId)}
    />
  )
}
