import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/account/ProfileForm"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single()
    : { data: null }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
      <div className="mt-6">
        <ProfileForm email={user?.email ?? ""} fullName={profile?.full_name ?? null} phone={profile?.phone ?? null} />
      </div>
    </div>
  )
}
