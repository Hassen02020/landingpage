import { createClient } from "@/lib/supabase/server"

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`${label}:`, err instanceof Error ? err.message : err)
    return fallback
  }
}

export type OrderSummary = {
  id: string
  orderNumber: string
  status: string
  totalCents: number
  currency: string
  createdAt: string
  items: { productName: string; variantLabel: string | null; quantity: number; totalCents: number }[]
  shippingAddress: {
    fullName: string
    line1: string
    line2: string | null
    city: string
    state: string
    postalCode: string
  } | null
}

const ORDER_SELECT =
  "id, order_number, status, total_cents, currency, created_at, order_items(product_name, variant_label, quantity, total_cents), order_addresses(type, full_name, line1, line2, city, state, postal_code)"

function mapOrder(o: any): OrderSummary {
  const shipping = (o.order_addresses as any[])?.find((a) => a.type === "shipping")
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    totalCents: o.total_cents,
    currency: o.currency,
    createdAt: o.created_at,
    items: o.order_items ?? [],
    shippingAddress: shipping
      ? {
          fullName: shipping.full_name,
          line1: shipping.line1,
          line2: shipping.line2,
          city: shipping.city,
          state: shipping.state,
          postalCode: shipping.postal_code,
        }
      : null,
  }
}

export async function getOrderByStripeSessionId(sessionId: string): Promise<OrderSummary | null> {
  return safe("getOrderByStripeSessionId", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle()

    if (error || !data) return null
    return mapOrder(data)
  }, null)
}

export async function getCustomerOrders(customerId: string): Promise<OrderSummary[]> {
  return safe("getCustomerOrders", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })

    if (error || !data) return []
    return (data as any[]).map(mapOrder)
  }, [])
}

export async function getOrderById(id: string, customerId: string): Promise<OrderSummary | null> {
  return safe("getOrderById", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .eq("customer_id", customerId)
      .maybeSingle()

    if (error || !data) return null
    return mapOrder(data)
  }, null)
}

export async function getOrderByNumber(orderNumber: string, customerId: string): Promise<OrderSummary | null> {
  return safe("getOrderByNumber", async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("order_number", orderNumber)
      .eq("customer_id", customerId)
      .maybeSingle()

    if (error || !data) return null
    return mapOrder(data)
  }, null)
}
