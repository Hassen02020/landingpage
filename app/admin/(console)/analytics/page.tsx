import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { StatCard } from "@/components/admin/StatCard"

export const metadata: Metadata = { title: "Analytics" }

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: orders } = await supabase.from("orders").select("status")

  const counts = STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = (orders ?? []).filter((o) => o.status === status).length
    return acc
  }, {})

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
      <p className="mt-1 text-sm text-ink-500">
        Order funnel by status. GA4/Meta/TikTok conversion event tracking is wired up in Phase 14.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((status) => (
          <StatCard key={status} label={status} value={String(counts[status])} />
        ))}
      </div>
    </div>
  )
}
