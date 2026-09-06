import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { getTenantBillingSummary } from "@/lib/data/billing"
import { formatPrice } from "@/lib/utils"
import { PlanActions } from "@/components/admin/PlanActions"

export const metadata: Metadata = { title: "Billing" }

const STATUS_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  active: "forest",
  trialing: "sand",
  past_due: "coral",
  canceled: "outline",
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((current / Math.max(limit, 1)) * 100))
  const over = limit !== null && current >= limit
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className={over ? "font-medium text-coral-600" : "text-ink-500"}>
          {current} {limit === null ? "" : `/ ${limit}`}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-2 rounded-full bg-ink-100">
          <div className={`h-2 rounded-full ${over ? "bg-coral-500" : "bg-forest"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default async function AdminBillingPage() {
  const supabase = await createClient()

  const [{ data: tenant }, { data: plans }] = await Promise.all([
    supabase.from("tenants").select("id").eq("slug", "petora").single(),
    supabase.from("billing_plans").select("code, name, price_cents, max_products, max_providers, max_orders_per_month").order("price_cents"),
  ])
  const tenantId = tenant?.id

  const summary = tenantId ? await getTenantBillingSummary(supabase, tenantId) : null

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Billing</h1>
        <p className="mt-1 text-sm text-ink-500">
          What this tenant pays PETORA for the platform itself (Commerce OS Phase 19) — separate from Autoship, which is
          what shoppers pay for recurring pet food deliveries.
        </p>
      </div>

      {summary && (
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-bold text-ink">
                {summary.plan.name} — {summary.plan.priceCents === 0 ? "Free" : `${formatPrice(summary.plan.priceCents)}/mo`}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[summary.status] ?? "outline"} className="capitalize">
                  {summary.status.replace("_", " ")}
                </Badge>
                {summary.currentPeriodEnd && (
                  <span className="text-xs text-ink-500">renews {new Date(summary.currentPeriodEnd).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            {tenantId && <PlanActions tenantId={tenantId} currentPlanCode={summary.plan.code} />}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <UsageBar label="Products" current={summary.usage.products.current} limit={summary.plan.maxProducts} />
            <UsageBar label="Connected providers" current={summary.usage.providers.current} limit={summary.plan.maxProviders} />
            <UsageBar label="Orders this month" current={summary.usage.ordersThisMonth.current} limit={summary.plan.maxOrdersPerMonth} />
          </div>
        </div>
      )}

      {!summary && (
        <div className="rounded-2xl border border-ink-100 bg-white p-5 text-sm text-ink-500">No billing subscription on file for this tenant.</div>
      )}

      <div>
        <h2 className="font-display text-lg font-bold text-ink">Plans</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <div
              key={plan.code}
              className={`rounded-2xl border p-5 ${plan.code === summary?.plan.code ? "border-forest bg-forest/5" : "border-ink-100 bg-white"}`}
            >
              <p className="font-display text-lg font-bold text-ink">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {plan.price_cents === 0 ? "Free" : formatPrice(plan.price_cents)}
                {plan.price_cents > 0 && <span className="text-sm font-normal text-ink-500">/mo</span>}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-600">
                <li>{plan.max_products === null ? "Unlimited products" : `Up to ${plan.max_products} products`}</li>
                <li>{plan.max_providers === null ? "Unlimited providers" : `Up to ${plan.max_providers} providers`}</li>
                <li>{plan.max_orders_per_month === null ? "Unlimited orders/mo" : `Up to ${plan.max_orders_per_month} orders/mo`}</li>
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Upgrading to a paid plan requires a Stripe checkout, which isn&apos;t configured in this environment — the
          upgrade button will report that honestly rather than granting the plan for free. Downgrading to Starter applies
          immediately.
        </p>
      </div>
    </div>
  )
}
