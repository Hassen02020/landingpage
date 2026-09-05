import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { formatPrice } from "@/lib/utils"

export const metadata: Metadata = { title: "Customer Details" }

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: orders }, { data: pets }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, created_at").eq("id", id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, total_cents, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("pets").select("id, name, species, breed").eq("profile_id", id),
  ])

  if (!profile) notFound()

  const lifetimeValueCents = (orders ?? []).reduce((sum, o) => sum + o.total_cents, 0)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{profile.full_name ?? profile.email}</h1>
      <p className="text-sm text-ink-500">{profile.email}{profile.phone ? ` · ${profile.phone}` : ""}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Lifetime Value</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatPrice(lifetimeValueCents)}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Orders</p>
          <p className="mt-1 text-lg font-semibold text-ink">{orders?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Pets</p>
          <p className="mt-1 text-lg font-semibold text-ink">{pets?.length ?? 0}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Orders</h2>
        <div className="mt-3 space-y-2">
          {(orders ?? []).map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-3 text-sm hover:shadow-card"
            >
              <span className="font-medium text-forest">{order.order_number}</span>
              <div className="flex items-center gap-3">
                <span>{formatPrice(order.total_cents)}</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
          {(!orders || orders.length === 0) && <p className="text-sm text-ink-500">No orders yet.</p>}
        </div>
      </div>

      {pets && pets.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Pets</h2>
          <div className="mt-3 space-y-2">
            {pets.map((pet) => (
              <div key={pet.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
                {pet.name} <span className="text-ink-500">({pet.species}{pet.breed ? `, ${pet.breed}` : ""})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
