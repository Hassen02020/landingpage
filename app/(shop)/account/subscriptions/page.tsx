import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { SubscriptionActions } from "@/components/account/SubscriptionActions"

export const metadata: Metadata = { title: "Autoship" }

const STATUS_VARIANT: Record<string, "forest" | "gold" | "outline"> = {
  active: "forest",
  paused: "gold",
  cancelled: "outline",
}

export default async function SubscriptionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = user
    ? await supabase
        .from("subscriptions")
        .select(
          "id, status, frequency_weeks, next_order_date, subscription_items(quantity, product_variants(size, products(name)))"
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null }

  const subscriptions = (data as any[]) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Autoship</h1>

      {subscriptions.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">
          You don&apos;t have any Autoship subscriptions yet. Choose &quot;Subscribe &amp; Save&quot; on any eligible
          product to set up recurring delivery.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-ink-100 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[sub.status] ?? "outline"} className="capitalize">
                      {sub.status}
                    </Badge>
                    <span className="text-xs text-ink-500">Every {sub.frequency_weeks} weeks</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-ink-700">
                    {(sub.subscription_items ?? []).map((item: any, i: number) => (
                      <p key={i}>
                        {item.product_variants?.products?.name}
                        {item.product_variants?.size ? ` — ${item.product_variants.size}` : ""} &times; {item.quantity}
                      </p>
                    ))}
                  </div>
                  {sub.status !== "cancelled" && (
                    <p className="mt-2 text-xs text-ink-500">
                      Next order {new Date(sub.next_order_date).toLocaleDateString("en-US")}
                    </p>
                  )}
                </div>
                <SubscriptionActions subscriptionId={sub.id} status={sub.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
