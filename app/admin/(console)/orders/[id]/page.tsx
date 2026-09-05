import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect"
import { RouteOrderButton } from "@/components/admin/RouteOrderButton"
import { Badge } from "@/components/ui/Badge"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Order Details" }

const ROUTING_VARIANT: Record<string, "forest" | "sand" | "outline" | "coral"> = {
  placed: "forest",
  pending: "sand",
  failed: "coral",
  not_applicable: "outline",
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, email, status, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, created_at, order_items(id, product_name, variant_label, sku, quantity, unit_price_cents, total_cents), order_addresses(type, full_name, line1, line2, city, state, postal_code)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!order) notFound()

  const { data: routing } = await supabase
    .from("order_routing")
    .select("order_item_id, status, provider_order_id, error, providers(name)")
    .eq("order_id", order.id)

  const routingByItem = new Map((routing ?? []).map((r: any) => [r.order_item_id, r]))

  const shipping = (order.order_addresses as any[])?.find((a) => a.type === "shipping")

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{order.order_number}</h1>
          <p className="text-sm text-ink-500">{order.email}</p>
        </div>
        <OrderStatusSelect orderId={order.id} status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Items</h2>
          <div className="mt-3 space-y-2">
            {(order.order_items as any[]).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-ink-700">
                  {item.product_name}
                  {item.variant_label ? ` — ${item.variant_label}` : ""} &times; {item.quantity}
                </span>
                <span className="font-medium text-ink">{formatPrice(item.total_cents)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>Shipping</span>
              <span>{formatPrice(order.shipping_cents)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>Tax</span>
              <span>{formatPrice(order.tax_cents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span>{formatPrice(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {shipping && (
          <div className="h-fit rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Shipping Address</h2>
            <p className="mt-2 text-sm text-ink-600">{shipping.full_name}</p>
            <p className="text-sm text-ink-600">
              {shipping.line1}
              {shipping.line2 ? `, ${shipping.line2}` : ""}
            </p>
            <p className="text-sm text-ink-600">
              {shipping.city}, {shipping.state} {shipping.postal_code}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Fulfillment routing</h2>
            <p className="mt-1 text-xs text-ink-500">
              Which supplier each item was placed with (Commerce OS Phase 13). Owned-inventory items don&apos;t route
              anywhere.
            </p>
          </div>
          <RouteOrderButton orderId={order.id} />
        </div>
        <div className="mt-4 space-y-2">
          {(order.order_items as any[]).map((item) => {
            const route = routingByItem.get(item.id)
            return (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-700">{item.product_name}</span>
                <div className="flex items-center gap-2">
                  {route?.providers?.name && <span className="text-xs text-ink-500">{route.providers.name}</span>}
                  {route?.provider_order_id && <span className="font-mono text-xs text-ink-400">{route.provider_order_id}</span>}
                  <Badge variant={ROUTING_VARIANT[route?.status ?? "pending"]} className="capitalize">
                    {route ? route.status.replace("_", " ") : "not routed yet"}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
