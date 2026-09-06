import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { BrandRowActions } from "@/components/admin/BrandRowActions"

export const metadata: Metadata = { title: "Brands" }

export default async function AdminBrandsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from("brands").select("id, name, is_active").order("sort_order")

  const brands = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Brands</h1>
        <ButtonLink href="/admin/brands/new">New Brand</ButtonLink>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/brands/${brand.id}`} className="font-medium text-forest hover:underline">
                    {brand.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={brand.is_active ? "forest" : "outline"}>{brand.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <BrandRowActions brandId={brand.id} />
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-500">
                  No brands yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
