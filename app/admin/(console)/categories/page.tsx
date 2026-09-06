import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { CategoryRowActions } from "@/components/admin/CategoryRowActions"

export const metadata: Metadata = { title: "Categories" }

export default async function AdminCategoriesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from("categories").select("id, name, slug, pet_type, is_active").order("sort_order")

  const categories = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Categories</h1>
        <ButtonLink href="/admin/categories/new">New Category</ButtonLink>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Pet Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/categories/${cat.id}`} className="font-medium text-forest hover:underline">
                    {cat.name}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize text-ink-600">{cat.pet_type}</td>
                <td className="px-4 py-3">
                  <Badge variant={cat.is_active ? "forest" : "outline"}>{cat.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <CategoryRowActions categoryId={cat.id} />
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
