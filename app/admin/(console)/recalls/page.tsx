import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { RecallForm } from "@/components/admin/RecallForm"

export const metadata: Metadata = { title: "Recalls" }

const SEVERITY_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  low: "sand",
  medium: "sand",
  high: "coral",
  critical: "coral",
}

export default async function AdminRecallsPage() {
  const supabase = await createClient()

  const [{ data: variants }, { data: recalls }] = await Promise.all([
    supabase.from("product_variants").select("id, sku, products(name)").order("sku"),
    supabase
      .from("recalls")
      .select("id, reason, severity, status, initiated_at, product_variants(sku, products(name)), inventory_lots(lot_number)")
      .order("initiated_at", { ascending: false })
      .limit(200),
  ])

  const variantOptions = ((variants as any[]) ?? []).map((v) => ({
    id: v.id,
    label: `${v.products?.name ?? "—"} (${v.sku})`,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Recalls</h1>
        <p className="mt-1 text-sm text-ink-500">
          An active recall is public — the storefront product page shows a banner (Commerce OS Phase 17). Without a
          specific lot, every lot of the item is covered.
        </p>
      </div>

      <RecallForm variants={variantOptions} />

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {((recalls as any[]) ?? []).map((recall) => (
              <tr key={recall.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 text-ink">
                  {recall.product_variants?.products?.name ?? "—"}{" "}
                  <span className="text-ink-400">({recall.product_variants?.sku})</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-500">{recall.inventory_lots?.lot_number ?? "All lots"}</td>
                <td className="px-4 py-3 text-ink-600">{recall.reason}</td>
                <td className="px-4 py-3">
                  <Badge variant={SEVERITY_VARIANT[recall.severity]} className="capitalize">
                    {recall.severity}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={recall.status === "active" ? "coral" : "outline"} className="capitalize">
                    {recall.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/recalls/${recall.id}`} className="text-xs font-medium text-forest hover:underline">
                    View affected orders
                  </Link>
                </td>
              </tr>
            ))}
            {(!recalls || recalls.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                  No recalls issued.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
