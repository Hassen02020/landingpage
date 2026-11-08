import { ROLE_LABELS } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { PasswordForm } from "./PasswordForm"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const me = await currentStaff()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Mon compte</h1>
      <section className="bg-white rounded-2xl border p-5 text-sm space-y-1">
        <div>E-mail : <strong dir="ltr">{me?.email}</strong></div>
        <div>Rôle : <strong>{me ? ROLE_LABELS[me.orgRole] : ""}</strong></div>
      </section>
      <section className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-black">Mot de passe</h2>
        <PasswordForm />
      </section>
    </div>
  )
}
