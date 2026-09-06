import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ProductForm } from "@/components/admin/ProductForm"
import { createProductAction } from "@/lib/actions/admin/products"

export const metadata: Metadata = { title: "New Product" }

export default async function NewProductPage() {
  const supabase = await createClient()
  const [{ data: brands }, { data: categories }] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">New Product</h1>
      <div className="mt-6">
        <ProductForm action={createProductAction} brands={brands ?? []} categories={categories ?? []} />
      </div>
    </div>
  )
}
