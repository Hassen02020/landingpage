import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"

export const metadata: Metadata = { title: "Subscriptions" }

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, frequency_weeks, next_order_date, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200)

  const subscriptions = (data as any[]) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Subscriptions</h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Frequency</th>
              <th className="px-4 py-3">Next Order</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 text-ink-700">{sub.profiles?.full_name ?? sub.profiles?.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={sub.status === "active" ? "forest" : "outline"} className="capitalize">
                    {sub.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink-600">Every {sub.frequency_weeks} weeks</td>
                <td className="px-4 py-3 text-ink-600">{new Date(sub.next_order_date).toLocaleDateString("en-US")}</td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-500">
                  No Autoship subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
