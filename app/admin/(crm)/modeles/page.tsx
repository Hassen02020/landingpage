import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listTemplates } from "@/lib/server/templates"
import { TemplateForm } from "./TemplateForm"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const me = await currentStaff()
  if (!can(me?.orgRole, "templates.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const templates = await listTemplates().catch(() => null)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Modèles de messages WhatsApp</h1>
        <p className="text-sm text-gray-600">Affichés sur la fiche de chaque lead : un clic ouvre WhatsApp avec le message rempli. Variables : <code>{"{prenom}"}</code> <code>{"{nom}"}</code> <code>{"{ref}"}</code> <code>{"{offre}"}</code> <code>{"{produit}"}</code>.</p>
      </div>
      {templates === null && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">La migration <code>0005_landing_team_templates.sql</code> n&apos;est pas encore appliquée.</div>}
      <section className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-black">Nouveau modèle</h2>
        <TemplateForm />
      </section>
      {(templates ?? []).map((t) => (
        <section key={t.id} className={`bg-white rounded-2xl border p-5 ${t.active ? "" : "opacity-60"}`}>
          <TemplateForm t={t} />
        </section>
      ))}
    </div>
  )
}
