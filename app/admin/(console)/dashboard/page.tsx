import type { Metadata } from "next"
import { StatCard } from "@/components/admin/StatCard"
import { getDashboardMetrics } from "@/lib/data/admin"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Admin Dashboard" }

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatPrice(metrics.revenueCents)} />
        <StatCard label="Orders" value={String(metrics.orderCount)} />
        <StatCard label="Customers" value={String(metrics.customerCount)} />
        <StatCard label="Avg. Order Value" value={formatPrice(metrics.aovCents)} />
        <StatCard label="Refunds" value={formatPrice(metrics.refundCents)} />
        <StatCard label="Active Subscriptions" value={String(metrics.subscriptionRevenueCents)} hint="Autoship revenue tracking lands with Stripe Billing (Phase 12)" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Best Sellers</h2>
          {metrics.bestSellers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No sales yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.bestSellers.map((p) => (
                <li key={p.productName} className="flex justify-between">
                  <span className="text-ink-700">{p.productName}</span>
                  <span className="font-medium text-ink">{p.unitsSold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Low Stock</h2>
          {metrics.lowStockVariants.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Nothing low on stock.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.lowStockVariants.map((v) => (
                <li key={v.sku} className="flex justify-between">
                  <span className="text-ink-700">
                    {v.productName} <span className="text-ink-400">({v.sku})</span>
                  </span>
                  <span className="font-medium text-coral-600">{v.quantityAvailable} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
