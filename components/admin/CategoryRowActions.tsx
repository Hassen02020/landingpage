"use client"

import { deleteCategoryAction } from "@/lib/actions/admin/categories"
import { DeleteRowButton } from "@/components/admin/DeleteRowButton"

export function CategoryRowActions({ categoryId }: { categoryId: string }) {
  return (
    <DeleteRowButton
      confirmMessage="Delete this category? This cannot be undone."
      onDelete={() => deleteCategoryAction(categoryId)}
    />
  )
}
