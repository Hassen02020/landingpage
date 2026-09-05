import { createClient } from "@/lib/supabase/server"

export type ValidCoupon = {
  id: string
  code: string
  type: "percentage" | "fixed" | "free_shipping"
  value: number
}

export async function validateCoupon(
  code: string,
  subtotalCents: number,
  customerId: string | null
): Promise<{ coupon: ValidCoupon | null; error?: string }> {
  const supabase = await createClient()
  const { data: coupon } = await supabase
    .from("coupons")
    .select("id, code, type, value, min_order_cents, usage_limit, usage_count, first_order_only, starts_at, expires_at, is_active")
    .eq("code", code.toUpperCase())
    .maybeSingle()

  if (!coupon || !coupon.is_active) return { coupon: null, error: "This coupon code is not valid." }

  const now = new Date()
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { coupon: null, error: "This coupon isn't active yet." }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { coupon: null, error: "This coupon has expired." }
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { coupon: null, error: "This coupon has reached its usage limit." }
  }
  if (subtotalCents < coupon.min_order_cents) {
    return { coupon: null, error: `This coupon requires a minimum order of $${(coupon.min_order_cents / 100).toFixed(2)}.` }
  }

  if (coupon.first_order_only) {
    if (!customerId) return { coupon: null, error: "Sign in to use this first-order coupon." }
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .in("status", ["paid", "processing", "shipped", "delivered"])
    if ((count ?? 0) > 0) return { coupon: null, error: "This coupon is valid for first orders only." }
  }

  return { coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value } }
}
