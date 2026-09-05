import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { CategoryForm } from "@/components/admin/CategoryForm"
import { updateCategoryAction } from "@/lib/actions/admin/categories"

export const metadata: Metadata = { title: "Edit Category" }

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, pet_type, image_url, is_active")
    .eq("id", id)
    .maybeSingle()

  if (!category) notFound()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Edit Category</h1>
      <div className="mt-6">
        <CategoryForm
          action={updateCategoryAction.bind(null, category.id)}
          defaultValues={{
            name: category.name,
            petType: category.pet_type,
            imageUrl: category.image_url,
            isActive: category.is_active,
          }}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  )
}
