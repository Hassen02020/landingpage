import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadChannelReports } from "@/lib/server/channels"
import { STATE_LABELS, SILENCE_DAYS, type ChannelState } from "@/lib/channel-status"

export const dynamic = "force-dynamic"

const TONE: Record<ChannelState, string> = {
  receiving: "bg-green-100 text-green-800", manual: "bg-gray-100 text-gray-700", not_connected: "bg-gray-100 text-gray-600",
  connected_unproven: "bg-amber-100 text-amber-800", silent: "bg-amber-100 text-amber-800", failing: "bg-red-100 text-red-700", degraded: "bg-red-100 text-red-700",
}

export default async function ChannelsPage() {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "reports.view")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux responsables et administrateurs.</p>
  const reports = await loadChannelReports(staff.organizationId ?? "")
  const alerts = reports.filter((r) => r.alert)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Canaux</h1>
        <p className="text-sm text-gray-600">
          L&apos;état réel de chaque canal. <strong>Un canal n&apos;est déclaré « Fonctionne » qu&apos;après un événement réel reçu</strong> : un test réussi prouve seulement que la plateforme accepte la requête. Silencieux = aucun événement depuis plus de {SILENCE_DAYS} jours (valeur par défaut).
        </p>
      </div>
      {alerts.length > 0 && <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm" data-testid="channel-alert">{alerts.length} canal(aux) demandent votre attention : {alerts.map((a) => a.label).join(", ")}.</div>}
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id} className="bg-white rounded-2xl border p-4 flex flex-wrap items-start justify-between gap-3" data-testid="channel-row" data-state={r.state}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><strong>{r.label}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[r.state]}`}>{STATE_LABELS[r.state]}</span></div>
              <p className="text-sm font-bold mt-1">{r.headline}</p>
              <p className="text-sm text-gray-600">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm"><Link href="/admin/integrations" className="text-brand-700 font-bold underline">Intégrations et journal des événements entrants</Link></p>
    </div>
  )
}
