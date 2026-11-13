import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listAdSpend } from "@/lib/server/ad-spend"
import { listCommissions } from "@/lib/server/commissions"
import { RentabiliteClient } from "./RentabiliteClient"

export const dynamic = "force-dynamic"

export default async function RentabilitePage() {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "ads.view")) {
    return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux responsables.</p>
  }
  const canManage = can(staff.orgRole, "ads.manage")
  const [spend, commissions] = await Promise.all([listAdSpend(), listCommissions()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Rentabilité</h1>
        <p className="text-gray-600 text-sm">Dépenses publicitaires saisies à la main et commissions importées d&apos;EasyV4 (provisoires tant qu&apos;elles ne sont pas confirmées).</p>
      </div>
      {(!spend.migrationApplied || !commissions.migrationApplied) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          La migration <code>0016_ad_economics.sql</code> n&apos;est pas encore appliquée dans Supabase : l&apos;écran est en lecture seule.
        </div>
      )}
      <RentabiliteClient
        canManage={canManage && spend.migrationApplied && commissions.migrationApplied}
        spend={spend.rows.map((r) => ({ id: r.id, date: r.spend_date, network: r.network, campaign: r.campaign, amount: Number(r.amount_tnd), voids: r.voids_id, reference: r.reference ?? null }))}
        commissions={commissions.rows.map((c) => ({ id: c.id, leadRef: c.lead_ref, reservation: c.external_ref, kind: c.kind, amount: Number(c.amount_tnd), status: c.status, date: c.event_date }))}
      />
    </div>
  )
}
