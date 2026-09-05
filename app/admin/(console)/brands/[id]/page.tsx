import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BrandForm } from "@/components/admin/BrandForm"
import { updateBrandAction } from "@/lib/actions/admin/brands"

export const metadata: Metadata = { title: "Edit Brand" }

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, description, logo_url, is_active")
    .eq("id", id)
    .maybeSingle()

  if (!brand) notFound()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Edit Brand</h1>
      <div className="mt-6">
        <BrandForm
          action={updateBrandAction.bind(null, brand.id)}
          defaultValues={{
            name: brand.name,
            description: brand.description,
            logoUrl: brand.logo_url,
            isActive: brand.is_active,
          }}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  )
}
