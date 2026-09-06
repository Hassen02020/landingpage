import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { AddressForm } from "@/components/account/AddressForm"
import { AddressCard } from "@/components/account/AddressCard"

export const metadata: Metadata = { title: "My Addresses" }

export default async function AddressesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = user
    ? await supabase
        .from("addresses")
        .select("id, label, full_name, line1, line2, city, state, postal_code, is_default")
        .eq("profile_id", user.id)
        .order("is_default", { ascending: false })
    : { data: [] }

  const addresses = (data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.full_name,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    isDefault: a.is_default,
  }))

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">My Addresses</h1>

      {addresses.length > 0 && (
        <div className="mt-6 space-y-3">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Add an Address</h2>
        <div className="mt-4">
          <AddressForm />
        </div>
      </div>
    </div>
  )
}
