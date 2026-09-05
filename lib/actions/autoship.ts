"use server"

import { redirect } from "next/navigation"
import { getStripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { autoshipSchema } from "@/lib/validations/autoship"

const AUTOSHIP_DISCOUNT_PERCENT = 5

export async function createAutoshipCheckoutAction(
  variantId: string,
  quantity: number,
  frequencyWeeks: number
): Promise<{ error?: string }> {
  // Client-side UI only offers valid choices, but this is a server action —
  // it can be invoked directly with arbitrary values, so re-validate before
  // touching Stripe or the database.
  const parsed = autoshipSchema.safeParse({ variantId, quantity, frequencyWeeks })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid Autoship request." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/pet-profile")}`)
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, sku, size, flavor, price_cents, products(name), inventory(quantity_available)")
    .eq("id", parsed.data.variantId)
    .single()

  if (variantError || !variant) return { error: "This product is no longer available." }

  if (!variant.price_cents || variant.price_cents <= 0) {
    return { error: "This product does not have a valid price." }
  }

  const inventory = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory
  if (!inventory || inventory.quantity_available <= 0) {
    return { error: "This product is currently out of stock." }
  }

  const { quantity: validQuantity, frequencyWeeks: validFrequencyWeeks } = parsed.data
  const product = Array.isArray(variant.products) ? variant.products[0] : variant.products
  const unitAmount = Math.round(variant.price_cents * (1 - AUTOSHIP_DISCOUNT_PERCENT / 100))
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  try {
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          quantity: validQuantity,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval: "week", interval_count: validFrequencyWeeks },
            product_data: {
              name: `${product?.name ?? "Product"}${variant.size ? ` — ${variant.size}` : ""} (Autoship)`,
              metadata: { variant_id: variant.id, sku: variant.sku },
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${siteUrl}/account/subscriptions?welcome=1`,
      cancel_url: `${siteUrl}/product`,
      metadata: {
        customer_id: user.id,
        variant_id: variant.id,
        quantity: String(validQuantity),
        frequency_weeks: String(validFrequencyWeeks),
      },
    })

    if (!session.url) return { error: "Could not start Autoship. Please try again." }
    redirect(session.url)
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err // next redirect() signal
    console.error("createAutoshipCheckoutAction:", err instanceof Error ? err.message : err)
    return { error: "Could not start Autoship. Please try again." }
  }
}
