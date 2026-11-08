import { currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { loadFormConfig } from "@/lib/server/org-public"
import { SITE_URL } from "@/lib/config"
import { FormConfigForm } from "./FormConfigForm"

export const dynamic = "force-dynamic"

export default async function FormPage() {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "site.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const config = await loadFormConfig()
  const slug = staff.organizationSlug
  const url = slug && slug !== "easy2book" ? `${SITE_URL.replace(/\/$/, "")}/o/${slug}` : null
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Formulaire de collecte</h1>
        <p className="text-sm text-gray-600">Choisissez les champs que vos visiteurs remplissent. Le nom, le téléphone et l&apos;accord de recontact sont toujours demandés.</p>
      </div>
      {url ? (
        <section className="rounded-2xl border bg-white p-5 text-sm">
          Adresse publique de votre formulaire : <a href={url} target="_blank" rel="noreferrer" className="font-bold text-violet-700 underline" dir="ltr">{url}</a>
        </section>
      ) : (
        <section className="rounded-2xl border bg-white p-5 text-sm text-gray-600">Easy2Book utilise ses propres pages publiques : cette configuration concerne les entreprises clientes.</section>
      )}
      <FormConfigForm config={config} />
    </div>
  )
}
