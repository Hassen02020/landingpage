import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { PromotionForm } from "@/components/admin/PromotionForm"
import { PromotionRowActions } from "@/components/admin/PromotionRowActions"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("promotions")
    .select("id, title, badge_text, is_active")
    .eq("placement", "homepage_banner")
    .order("sort_order")

  const promotions = data ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-500">Manage the homepage promotional banners.</p>

      <div className="mt-6 space-y-3">
        {promotions.map((promo) => (
          <div key={promo.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4">
            <div>
              <p className="text-sm font-medium text-ink">{promo.title}</p>
              {promo.badge_text && <p className="text-xs text-ink-500">{promo.badge_text}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={promo.is_active ? "forest" : "outline"}>{promo.is_active ? "Active" : "Inactive"}</Badge>
              <PromotionRowActions promotionId={promo.id} isActive={promo.is_active} />
            </div>
          </div>
        ))}
        {promotions.length === 0 && <p className="text-sm text-ink-500">No promotions yet.</p>}
      </div>

      <div className="mt-8 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Add Promotion</h2>
        <div className="mt-4">
          <PromotionForm />
        </div>
      </div>
    </div>
  )
}
