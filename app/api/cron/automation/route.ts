import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { syncProviderCatalog } from "@/lib/providers/syncCatalog"
import { syncProviderInventory } from "@/lib/providers/syncInventory"
import { checkFulfillmentForTenant } from "@/lib/providers/checkFulfillment"
import { selectOutOfStockProductIds } from "@/lib/automation/stockout"

/**
 * Scheduled by vercel.json to run automatically (Commerce OS Phase 18).
 * Automates what Phases 9/12/14 built as manual admin-console actions:
 * provider catalog sync, inventory sync, and fulfillment checks — plus
 * two opt-in automation rules read per tenant. No user is signed in for
 * a cron invocation, so this runs on the service-role client throughout,
 * the same trust level the Stripe webhook already uses.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error("automation cron: CRON_SECRET is not configured — refusing all requests.")
    return NextResponse.json({ error: "Cron not configured." }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: tenants, error: tenantsError } = await supabase.from("tenants").select("id").eq("status", "active")
  if (tenantsError) {
    console.error("automation cron: failed to load tenants —", tenantsError.message)
    return NextResponse.json({ error: `Failed to load tenants: ${tenantsError.message}` }, { status: 500 })
  }

  const { data: availableProviders, error: providersError } = await supabase
    .from("providers")
    .select("id, code")
    .eq("status", "available")
  if (providersError) {
    console.error("automation cron: failed to load providers —", providersError.message)
    return NextResponse.json({ error: `Failed to load providers: ${providersError.message}` }, { status: 500 })
  }

  const results = []

  for (const tenant of tenants ?? []) {
    const providerResults = []

    for (const provider of availableProviders ?? []) {
      const catalog = await syncProviderCatalog(supabase, tenant.id, provider.code)
      const inventory = await syncProviderInventory(supabase, tenant.id, provider.code)
      providerResults.push({ code: provider.code, catalog, inventory })
    }

    const fulfillment = await checkFulfillmentForTenant(supabase, tenant.id)

    const { data: rules } = await supabase.from("automation_rules").select("type, enabled").eq("tenant_id", tenant.id)
    const enabled = new Set((rules ?? []).filter((r) => r.enabled).map((r) => r.type))

    const automation: Record<string, unknown> = {}

    if (enabled.has("pause_on_stockout")) {
      automation.pauseOnStockout = await pauseStockoutProducts(supabase, tenant.id)
    }

    if (enabled.has("alert_on_sync_failure")) {
      const failed = providerResults.filter((p) => !p.catalog.success || !p.inventory.success)
      if (failed.length > 0) {
        await supabase.from("automation_runs").insert({
          tenant_id: tenant.id,
          rule_type: "alert_on_sync_failure",
          triggered_by: "cron",
          summary: { failedProviders: failed.map((p) => p.code) },
          items_affected: failed.length,
        })
      }
      automation.alertOnSyncFailure = { failedCount: failed.length }
    }

    const tenantSummary = { providers: providerResults, fulfillment, automation }

    await supabase.from("automation_runs").insert({
      tenant_id: tenant.id,
      rule_type: "cron_pass",
      triggered_by: "cron",
      summary: tenantSummary,
      items_affected: providerResults.length,
    })

    results.push({ tenantId: tenant.id, ...tenantSummary })
  }

  return NextResponse.json({ ok: true, results })
}

/**
 * Opt-in automation rule: archive a product once every variant is out of
 * stock. Gated behind automation_rules.enabled per tenant — never a
 * silent default, since hiding a product a merchant wants visible (e.g.
 * for pre-order) would be the wrong call to make on their behalf.
 */
async function pauseStockoutProducts(supabase: SupabaseClient, tenantId: string) {
  const { data: products } = await supabase
    .from("products")
    .select("id, product_variants(id, inventory(quantity_available))")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(500)

  const outOfStockIds = selectOutOfStockProductIds((products as any[]) ?? [])

  if (outOfStockIds.length > 0) {
    await supabase.from("products").update({ status: "archived" }).in("id", outOfStockIds)

    await supabase.from("automation_runs").insert({
      tenant_id: tenantId,
      rule_type: "pause_on_stockout",
      triggered_by: "cron",
      summary: { productIds: outOfStockIds },
      items_affected: outOfStockIds.length,
    })
  }

  return { itemsAffected: outOfStockIds.length }
}
