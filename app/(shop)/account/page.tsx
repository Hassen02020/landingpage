import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My Account" }

export default async function AccountOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Manage your orders, pets, Autoship subscriptions, and account details from here.
      </p>
    </div>
  )
}
