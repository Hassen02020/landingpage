import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PricingRuleForm } from "@/components/admin/PricingRuleForm"

export const metadata: Metadata = { title: "New Pricing Rule" }

export default async function NewPricingRulePage() {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", "petora").single()
  if (!tenant) redirect("/admin/pricing")

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">New Pricing Rule</h1>
      <div className="mt-6">
        <PricingRuleForm tenantId={tenant.id} />
      </div>
    </div>
  )
}
