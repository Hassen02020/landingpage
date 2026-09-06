import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { PricingRuleRowActions } from "@/components/admin/PricingRuleRowActions"

export const metadata: Metadata = { title: "Pricing" }

export default async function AdminPricingPage() {
  const supabase = await createClient()

  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", "petora").single()
  const tenantId = tenant?.id

  const { data: rules } = tenantId
    ? await supabase
        .from("pricing_rules")
        .select("id, name, markup_type, markup_value, min_margin_cents, is_default, created_at")
        .eq("tenant_id", tenantId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] as any[] }

  const { data: recentHistory } = tenantId
    ? await supabase
        .from("price_history")
        .select("id, cost_cents, price_cents, floor_applied, created_at, product_variants(sku, products(name))")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as any[] }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Pricing</h1>
          <p className="mt-1 text-sm text-ink-500">
            Markup rules applied to supplier cost when a staged listing is promoted (Commerce OS Phase 11). The default
            rule applies automatically.
          </p>
        </div>
        {tenantId && <ButtonLink href="/admin/pricing/new">New Rule</ButtonLink>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Markup</th>
              <th className="px-4 py-3 text-right">Min margin</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((rule) => (
              <tr key={rule.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink">{rule.name}</td>
                <td className="px-4 py-3 text-ink-600">
                  {rule.markup_type === "percentage" ? `${rule.markup_value}% markup` : `${rule.markup_value}¢ flat markup`}
                </td>
                <td className="px-4 py-3 text-right text-ink-700">${(rule.min_margin_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">{rule.is_default && <Badge variant="forest">Default</Badge>}</td>
                <td className="px-4 py-3">
                  {tenantId && <PricingRuleRowActions ruleId={rule.id} tenantId={tenantId} isDefault={rule.is_default} />}
                </td>
              </tr>
            ))}
            {(!rules || rules.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No pricing rules yet — promoted listings will sell at cost until one exists.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-ink">Recent computed prices</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3">Floor applied</th>
              </tr>
            </thead>
            <tbody>
              {(recentHistory ?? []).map((row: any) => (
                <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 text-ink">{row.product_variants?.products?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{row.product_variants?.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-ink-700">${(row.cost_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-ink-700">${(row.price_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {row.floor_applied && (
                      <Badge variant="sand" className="capitalize">
                        Floor applied
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {(!recentHistory || recentHistory.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    Nothing computed yet — promote a staged listing to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
