import type { Metadata } from "next"
import { CouponForm } from "@/components/admin/CouponForm"

export const metadata: Metadata = { title: "New Coupon" }

export default function NewCouponPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">New Coupon</h1>
      <div className="mt-6">
        <CouponForm />
      </div>
    </div>
  )
}
