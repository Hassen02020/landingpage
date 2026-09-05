"use server"

import { redirect } from "next/navigation"
import { getStripe } from "@/lib/stripe"
import { getCart } from "@/lib/data/cart"
import { createClient } from "@/lib/supabase/server"
import { checkoutSchema } from "@/lib/validations/checkout"
import { validateCoupon } from "@/lib/coupons"

const FREE_SHIPPING_THRESHOLD_CENTS = 4900
const STANDARD_SHIPPING_CENTS = 699
const EXPRESS_SHIPPING_CENTS = 1499

export type CheckoutActionState = { error?: string } | undefined

function computeShippingCents(method: "standard" | "express", subtotalCents: number) {
  if (method === "express") return EXPRESS_SHIPPING_CENTS
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : STANDARD_SHIPPING_CENTS
}

export async function createCheckoutSessionAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    phone: formData.get("phone") || undefined,
    shippingMethod: formData.get("shippingMethod") || "standard",
    couponCode: formData.get("couponCode") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form for errors." }
  }

  const cart = await getCart()

  if (cart.items.length === 0) {
    return { error: "Your cart is empty." }
  }

  if (cart.items.some((item) => !item.inStock)) {
    return { error: "Remove out-of-stock items before checking out." }
  }

  let shippingCents = computeShippingCents(parsed.data.shippingMethod, cart.subtotalCents)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let stripeCouponId: string | null = null
  let appliedCouponId: string | null = null

  try {
    const stripe = getStripe()

    if (parsed.data.couponCode) {
      const { coupon, error } = await validateCoupon(parsed.data.couponCode, cart.subtotalCents, user?.id ?? null)
      if (error) return { error }
      if (coupon) {
        appliedCouponId = coupon.id
        if (coupon.type === "free_shipping") {
          shippingCents = 0
        } else {
          const stripeCoupon = await stripe.coupons.create(
            coupon.type === "percentage"
              ? { percent_off: coupon.value, duration: "once" }
              : { amount_off: Math.round(coupon.value * 100), currency: "usd", duration: "once" }
          )
          stripeCouponId = stripeCoupon.id
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.email,
      line_items: cart.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: item.unitPriceCents,
          product_data: {
            name: item.productName + (item.variantLabel ? ` — ${item.variantLabel}` : ""),
            metadata: { variant_id: item.variantId, sku: item.sku },
          },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingCents, currency: "usd" },
            display_name: parsed.data.shippingMethod === "express" ? "Express Shipping" : "Standard Shipping",
          },
        },
      ],
      ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
      success_url: `${siteUrl}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout`,
      metadata: {
        cart_id: cart.id ?? "",
        customer_id: user?.id ?? "",
        full_name: parsed.data.fullName,
        phone: parsed.data.phone ?? "",
        line1: parsed.data.line1,
        line2: parsed.data.line2 ?? "",
        city: parsed.data.city,
        state: parsed.data.state,
        postal_code: parsed.data.postalCode,
        coupon_id: appliedCouponId ?? "",
      },
    })

    if (!session.url) {
      return { error: "Could not start checkout. Please try again." }
    }

    redirect(session.url)
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err // next redirect() signal
    console.error("createCheckoutSessionAction:", err instanceof Error ? err.message : err)
    return { error: "Could not start checkout. Please try again." }
  }
}
