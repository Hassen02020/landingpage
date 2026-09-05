import { NextResponse, type NextRequest } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceRoleClient()
  const meta = session.metadata ?? {}
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id

  if (!stripeSubscriptionId || !meta.customer_id || !meta.variant_id) return

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle()

  if (existing) return

  const frequencyWeeks = Number(meta.frequency_weeks) || 4
  const shipping = session.collected_information?.shipping_details ?? null
  const nextOrderDate = new Date()
  nextOrderDate.setDate(nextOrderDate.getDate() + frequencyWeeks * 7)

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: meta.customer_id,
      status: "active",
      frequency_weeks: frequencyWeeks,
      next_order_date: nextOrderDate.toISOString().slice(0, 10),
      shipping_address: shipping
        ? { name: shipping.name, address: shipping.address }
        : { name: session.customer_details?.name, address: session.customer_details?.address },
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
    })
    .select("id")
    .single()

  if (error || !subscription) {
    console.error("handleSubscriptionCheckoutCompleted: failed to create subscription", error?.message)
    return
  }

  await supabase.from("subscription_items").insert({
    subscription_id: subscription.id,
    variant_id: meta.variant_id,
    quantity: Number(meta.quantity) || 1,
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  const stripeSubscriptionId = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof stripeSubscriptionId === "string" ? stripeSubscriptionId : stripeSubscriptionId?.id
  if (!subscriptionId) return // one-off invoice, not an Autoship renewal

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle()
  if (existingOrder) return

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, customer_id, frequency_weeks, shipping_address")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle()
  if (!subscription) return

  const { data: items } = await supabase
    .from("subscription_items")
    .select("variant_id, quantity, product_variants(sku, price_cents, products(name))")
    .eq("subscription_id", subscription.id)

  if (!items || items.length === 0) return

  const { data: orderNumberResult } = await supabase.rpc("generate_order_number")
  const orderNumber = orderNumberResult ?? `PETORA-${Date.now()}`
  const totalCents = invoice.amount_paid ?? 0

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: subscription.customer_id,
      email: invoice.customer_email ?? "",
      status: "paid",
      subtotal_cents: totalCents,
      shipping_cents: 0,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: totalCents,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      stripe_invoice_id: invoice.id,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    console.error("handleInvoicePaid: failed to create order", orderError?.message)
    return
  }

  for (const item of items as any[]) {
    const variant = item.product_variants
    await supabase.from("order_items").insert({
      order_id: order.id,
      variant_id: item.variant_id,
      product_name: variant?.products?.name ?? "Autoship Product",
      variant_label: "Autoship",
      sku: variant?.sku ?? "",
      quantity: item.quantity,
      unit_price_cents: variant?.price_cents ?? 0,
      total_cents: (variant?.price_cents ?? 0) * item.quantity,
    })

    const { data: decremented, error: decrementError } = await supabase.rpc("decrement_inventory", {
      p_variant_id: item.variant_id,
      p_quantity: item.quantity,
    })
    if (decrementError || !decremented) {
      console.error(
        `handleInvoicePaid: inventory decrement failed for variant ${item.variant_id} (insufficient stock or missing row)`,
        decrementError?.message
      )
    }
  }

  const shipping = subscription.shipping_address as any
  if (shipping?.address) {
    await supabase.from("order_addresses").insert({
      order_id: order.id,
      type: "shipping",
      full_name: shipping.name ?? "",
      line1: shipping.address.line1 ?? "",
      line2: shipping.address.line2 ?? null,
      city: shipping.address.city ?? "",
      state: shipping.address.state ?? "",
      postal_code: shipping.address.postal_code ?? "",
      country: shipping.address.country ?? "US",
    })
  }

  const nextOrderDate = new Date()
  nextOrderDate.setDate(nextOrderDate.getDate() + subscription.frequency_weeks * 7)
  await supabase
    .from("subscriptions")
    .update({ next_order_date: nextOrderDate.toISOString().slice(0, 10) })
    .eq("id", subscription.id)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "subscription") {
    await handleSubscriptionCheckoutCompleted(session)
    return
  }

  const supabase = createServiceRoleClient()

  // Idempotency: Stripe retries webhooks, so a session we've already turned into an order is a no-op.
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle()

  if (existingOrder) return

  const stripe = getStripe()
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
    limit: 100,
  })

  const meta = session.metadata ?? {}
  const subtotalCents = session.amount_subtotal ?? 0
  const shippingCents = session.shipping_cost?.amount_total ?? 0
  const taxCents = session.total_details?.amount_tax ?? 0
  const discountCents = session.total_details?.amount_discount ?? 0
  const totalCents = session.amount_total ?? 0

  const { data: orderNumberResult } = await supabase.rpc("generate_order_number")
  const orderNumber = orderNumberResult ?? `PETORA-${Date.now()}`

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: meta.customer_id || null,
      email: session.customer_email ?? session.customer_details?.email ?? "",
      status: "paid",
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      currency: (session.currency ?? "usd").toUpperCase(),
      coupon_id: meta.coupon_id || null,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      stripe_checkout_session_id: session.id,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    console.error("handleCheckoutCompleted: failed to create order", orderError?.message)
    throw new Error("Failed to create order")
  }

  if (meta.coupon_id) {
    const { data: incremented, error: incrementError } = await supabase.rpc("increment_coupon_usage", {
      p_coupon_id: meta.coupon_id,
    })
    if (incrementError || !incremented) {
      console.error(
        `handleCheckoutCompleted: coupon usage increment failed for coupon ${meta.coupon_id} (limit reached or missing row)`,
        incrementError?.message
      )
    }
  }

  const variantIds: string[] = []

  for (const line of lineItems.data) {
    const product = line.price?.product
    const productMeta = typeof product === "object" && product && "metadata" in product ? product.metadata : {}
    const variantId = (productMeta as Record<string, string>)?.variant_id

    await supabase.from("order_items").insert({
      order_id: order.id,
      variant_id: variantId || null,
      product_name: line.description ?? "Product",
      variant_label: null,
      sku: (productMeta as Record<string, string>)?.sku ?? "",
      quantity: line.quantity ?? 1,
      unit_price_cents: line.price?.unit_amount ?? 0,
      total_cents: line.amount_total ?? 0,
    })

    if (variantId) {
      variantIds.push(variantId)
      const { data: decremented, error: decrementError } = await supabase.rpc("decrement_inventory", {
        p_variant_id: variantId,
        p_quantity: line.quantity ?? 1,
      })
      if (decrementError || !decremented) {
        console.error(
          `handleCheckoutCompleted: inventory decrement failed for variant ${variantId} (insufficient stock or missing row)`,
          decrementError?.message
        )
      }
    }
  }

  await supabase.from("order_addresses").insert([
    {
      order_id: order.id,
      type: "shipping",
      full_name: meta.full_name || session.customer_details?.name || "",
      line1: meta.line1 || "",
      line2: meta.line2 || null,
      city: meta.city || "",
      state: meta.state || "",
      postal_code: meta.postal_code || "",
      country: "US",
      phone: meta.phone || null,
    },
  ])

  await supabase.from("payments").insert({
    order_id: order.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    amount_cents: totalCents,
    currency: (session.currency ?? "usd").toUpperCase(),
    status: "succeeded",
    method: "card",
  })

  if (meta.cart_id) {
    await supabase.from("cart_items").delete().eq("cart_id", meta.cart_id)
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const supabase = createServiceRoleClient()
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (!order) return

  const status = charge.refunded ? "refunded" : "processing"
  await supabase.from("orders").update({ status }).eq("id", order.id)

  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (payment) {
    await supabase.from("refunds").insert({
      payment_id: payment.id,
      order_id: order.id,
      amount_cents: charge.amount_refunded,
      status: "succeeded",
      stripe_refund_id: charge.id,
    })
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      default:
        break
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
