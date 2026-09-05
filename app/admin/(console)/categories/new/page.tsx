import type { Metadata } from "next"
import { CategoryForm } from "@/components/admin/CategoryForm"
import { createCategoryAction } from "@/lib/actions/admin/categories"

export const metadata: Metadata = { title: "New Category" }

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">New Category</h1>
      <div className="mt-6">
        <CategoryForm action={createCategoryAction} />
      </div>
    </div>
  )
}
