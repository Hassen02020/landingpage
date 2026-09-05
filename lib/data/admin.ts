import { createClient } from "@/lib/supabase/server"

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`${label}:`, err instanceof Error ? err.message : err)
    return fallback
  }
}

export type DashboardMetrics = {
  revenueCents: number
  orderCount: number
  customerCount: number
  aovCents: number
  refundCents: number
  subscriptionRevenueCents: number
  lowStockVariants: { sku: string; productName: string; quantityAvailable: number }[]
  bestSellers: { productName: string; unitsSold: number }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return safe(
    "getDashboardMetrics",
    async () => {
      const supabase = await createClient()

      const [{ data: orders }, { count: customerCount }, { data: refunds }, { data: subs }, { data: lowStock }, { data: orderItems }] =
        await Promise.all([
          supabase.from("orders").select("total_cents, status").in("status", ["paid", "processing", "shipped", "delivered"]),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
          supabase.from("refunds").select("amount_cents").eq("status", "succeeded"),
          supabase.from("subscriptions").select("id").eq("status", "active"),
          supabase
            .from("inventory")
            .select("quantity_available, product_variants(sku, products(name))")
            .lt("quantity_available", 10)
            .order("quantity_available", { ascending: true })
            .limit(5),
          supabase.from("order_items").select("product_name, quantity"),
        ])

      const revenueCents = (orders ?? []).reduce((sum, o) => sum + o.total_cents, 0)
      const orderCount = (orders ?? []).length
      const aovCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0
      const refundCents = (refunds ?? []).reduce((sum, r) => sum + r.amount_cents, 0)

      const unitsByProduct = new Map<string, number>()
      for (const item of orderItems ?? []) {
        unitsByProduct.set(item.product_name, (unitsByProduct.get(item.product_name) ?? 0) + item.quantity)
      }
      const bestSellers = Array.from(unitsByProduct.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([productName, unitsSold]) => ({ productName, unitsSold }))

      return {
        revenueCents,
        orderCount,
        customerCount: customerCount ?? 0,
        aovCents,
        refundCents,
        subscriptionRevenueCents: 0,
        lowStockVariants: (lowStock as any[] ?? []).map((v) => ({
          sku: v.product_variants?.sku ?? "",
          productName: v.product_variants?.products?.name ?? "",
          quantityAvailable: v.quantity_available,
        })),
        bestSellers,
      }
    },
    {
      revenueCents: 0,
      orderCount: 0,
      customerCount: 0,
      aovCents: 0,
      refundCents: 0,
      subscriptionRevenueCents: 0,
      lowStockVariants: [],
      bestSellers: [],
    }
  )
}
