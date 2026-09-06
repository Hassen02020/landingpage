import type { SupabaseClient } from "@supabase/supabase-js"
import { checkQuota, type QuotaCheck } from "@/lib/billing/quota"

export type TenantBillingSummary = {
  plan: { code: string; name: string; priceCents: number; maxProducts: number | null; maxProviders: number | null; maxOrdersPerMonth: number | null }
  status: string
  currentPeriodEnd: string | null
  usage: {
    products: { current: number; quota: QuotaCheck }
    providers: { current: number; quota: QuotaCheck }
    ordersThisMonth: { current: number; quota: QuotaCheck }
  }
}

export async function getTenantBillingSummary(supabase: SupabaseClient, tenantId: string): Promise<TenantBillingSummary | null> {
  const { data: subscription } = await supabase
    .from("tenant_billing_subscriptions")
    .select("status, current_period_end, billing_plans(code, name, price_cents, max_products, max_providers, max_orders_per_month)")
    .eq("tenant_id", tenantId)
    .single()

  if (!subscription) return null
  const plan = Array.isArray(subscription.billing_plans) ? subscription.billing_plans[0] : subscription.billing_plans
  if (!plan) return null

  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const [{ count: productCount }, { count: providerCount }, { count: orderCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "archived"),
    supabase.from("provider_connections").select("provider_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "connected"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth.toISOString()),
  ])

  return {
    plan: {
      code: plan.code,
      name: plan.name,
      priceCents: plan.price_cents,
      maxProducts: plan.max_products,
      maxProviders: plan.max_providers,
      maxOrdersPerMonth: plan.max_orders_per_month,
    },
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    usage: {
      products: { current: productCount ?? 0, quota: checkQuota(productCount ?? 0, plan.max_products) },
      providers: { current: providerCount ?? 0, quota: checkQuota(providerCount ?? 0, plan.max_providers) },
      ordersThisMonth: { current: orderCount ?? 0, quota: checkQuota(orderCount ?? 0, plan.max_orders_per_month) },
    },
  }
}
