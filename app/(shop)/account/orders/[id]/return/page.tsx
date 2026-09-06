import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getOrderById } from "@/lib/data/orders"
import { getReturnableItems } from "@/lib/data/returns"
import { ReturnRequestForm } from "@/components/account/ReturnRequestForm"

export const metadata: Metadata = { title: "Request a Return" }

export default async function RequestReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const order = await getOrderById(id, user.id)
  if (!order) notFound()

  const items = await getReturnableItems(id, user.id)
  const hasEligibleItems = items.some((item) => item.remaining > 0)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Request a Return</h1>
      <p className="mt-1 text-sm text-ink-500">Order {order.orderNumber}</p>

      <div className="mt-6 max-w-lg">
        {hasEligibleItems ? (
          <ReturnRequestForm orderId={id} items={items} />
        ) : (
          <p className="text-sm text-ink-500">There&apos;s nothing left on this order eligible for a new return request.</p>
        )}
      </div>
    </div>
  )
}
