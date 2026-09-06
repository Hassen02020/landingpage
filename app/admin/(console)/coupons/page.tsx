import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { CouponRowActions } from "@/components/admin/CouponRowActions"

export const metadata: Metadata = { title: "Coupons" }

const TYPE_LABEL: Record<string, string> = {
  percentage: "% off",
  fixed: "$ off",
  free_shipping: "Free shipping",
}

export default async function AdminCouponsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("coupons")
    .select("id, code, type, value, usage_count, usage_limit, is_active")
    .order("created_at", { ascending: false })

  const coupons = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Coupons</h1>
        <ButtonLink href="/admin/coupons/new">New Coupon</ButtonLink>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink">{coupon.code}</td>
                <td className="px-4 py-3 text-ink-600">{TYPE_LABEL[coupon.type]}</td>
                <td className="px-4 py-3 text-ink-600">
                  {coupon.type === "free_shipping" ? "—" : coupon.type === "percentage" ? `${coupon.value}%` : `$${coupon.value}`}
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {coupon.usage_count}
                  {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={coupon.is_active ? "forest" : "outline"}>{coupon.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <CouponRowActions couponId={coupon.id} isActive={coupon.is_active} />
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
