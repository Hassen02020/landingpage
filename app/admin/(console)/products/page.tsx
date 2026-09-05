import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { ProductRowActions } from "@/components/admin/ProductRowActions"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Products" }

const STATUS_VARIANT: Record<string, "forest" | "sand" | "outline"> = {
  active: "forest",
  draft: "sand",
  archived: "outline",
}

export default async function AdminProductsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id, name, status, brands(name), product_variants(price_cents, is_default)")
    .order("created_at", { ascending: false })
    .limit(200)

  const products = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Products</h1>
        <ButtonLink href="/admin/products/new">New Product</ButtonLink>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(products as any[]).map((product) => {
              const brand = Array.isArray(product.brands) ? product.brands[0] : product.brands
              const variant =
                product.product_variants?.find((v: any) => v.is_default) ?? product.product_variants?.[0]

              return (
                <tr key={product.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${product.id}`} className="font-medium text-forest hover:underline">
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{brand?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[product.status] ?? "sand"} className="capitalize">
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-700">
                    {variant ? formatPrice(variant.price_cents) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ProductRowActions productId={product.id} />
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
