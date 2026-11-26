import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadWorklist } from "@/lib/server/follow-ups"
import { DEFAULT_RULES, RULE_LABELS } from "@/lib/follow-up-rules"

export const dynamic = "force-dynamic"

export default async function ToTreatPage() {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "leads.view_assigned")) return <p className="bg-white rounded-2xl p-6">Accès réservé à l&apos;équipe.</p>
  const { alerts, openLeads } = await loadWorklist()
  const urgent = alerts.filter((a) => a.severity === "urgent")
  const escalations = can(staff.orgRole, "leads.assign") ? alerts.filter((a) => a.escalate) : []
  const row = (a: (typeof alerts)[number], i: number) => (
    <li key={`${a.leadId}-${a.rule}-${i}`} className="bg-white rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="todo-row">
      <div className="min-w-0">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold mr-2 ${a.severity === "urgent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{RULE_LABELS[a.rule]}</span>
        <strong>{a.ref}</strong> · {a.message}
        <span className="text-gray-500"> → {a.suggestion}</span>
      </div>
      <Link href={`/admin/leads/${a.leadId}`} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white">Ouvrir</Link>
    </li>
  )
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">À traiter</h1>
        <p className="text-sm text-gray-600">
          Les dossiers qui demandent une action : jamais traités, relances échues, devis sans réponse, sans responsable. Cette liste <strong>n&apos;envoie aucun message</strong> : le conseiller agit, dans le respect du consentement et des règles des plateformes. Un dossier réservé, gagné ou perdu n&apos;y apparaît plus.
        </p>
        <p className="text-sm text-gray-600">Seuils par défaut (à valider) : urgent après {DEFAULT_RULES.firstResponseMinutes} min sans traitement, responsable alerté après {DEFAULT_RULES.escalateAfterMinutes / 60} h, devis relancé après {DEFAULT_RULES.quoteSilenceDays} jours sans échange.</p>
      </div>
      <section aria-label="Résumé" className="grid grid-cols-3 gap-3">
        {[["Dossiers ouverts", openLeads], ["Alertes", alerts.length], ["Urgentes", urgent.length]].map(([l, v]) => (
          <div key={String(l)} className="bg-white rounded-2xl border p-4"><div className="text-xs text-gray-500">{l}</div><div className="text-2xl font-black" data-testid="todo-stat">{v}</div></div>
        ))}
      </section>
      {escalations.length > 0 && (
        <section aria-label="À escalader" className="space-y-2">
          <h2 className="font-black">À escalader ({escalations.length})</h2>
          <ul className="space-y-2">{escalations.map(row)}</ul>
        </section>
      )}
      {alerts.length === 0 ? <p className="bg-white rounded-2xl p-6 text-sm text-gray-500">Rien à traiter : tous les dossiers ouverts sont à jour.</p> : <ul className="space-y-2">{alerts.map(row)}</ul>}
    </div>
  )
}
