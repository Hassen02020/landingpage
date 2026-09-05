"use client"

import { deleteBrandAction } from "@/lib/actions/admin/brands"
import { DeleteRowButton } from "@/components/admin/DeleteRowButton"

export function BrandRowActions({ brandId }: { brandId: string }) {
  return (
    <DeleteRowButton confirmMessage="Delete this brand? This cannot be undone." onDelete={() => deleteBrandAction(brandId)} />
  )
}
