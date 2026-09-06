import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { ReturnRowActions } from "@/components/admin/ReturnRowActions"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Returns" }

const STATUS_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  requested: "sand",
  approved: "sand",
  received: "sand",
  refund_initiated: "forest",
  refunded: "forest",
  rejected: "outline",
  refund_failed: "coral",
}

export default async function AdminReturnsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("returns")
    .select("id, status, reason, refund_amount_cents, refund_error, requested_at, orders(order_number, email)")
    .order("requested_at", { ascending: false })
    .limit(200)

  const returns = (data as any[]) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Returns</h1>
      <p className="mt-1 text-sm text-ink-500">
        Customer-requested returns against PETORA&apos;s own Stripe charge (Commerce OS Phase 16). Approve, mark
        received (restocks inventory), then initiate the refund.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Refund</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((ret) => (
              <tr key={ret.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink">{ret.orders?.order_number ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{ret.orders?.email ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{ret.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[ret.status] ?? "outline"} className="capitalize">
                    {ret.status.replace("_", " ")}
                  </Badge>
                  {ret.refund_error && <p className="mt-1 text-xs text-coral-600">{ret.refund_error}</p>}
                </td>
                <td className="px-4 py-3 text-right text-ink-700">
                  {ret.refund_amount_cents != null ? formatPrice(ret.refund_amount_cents) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnRowActions returnId={ret.id} status={ret.status} />
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                  No return requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
