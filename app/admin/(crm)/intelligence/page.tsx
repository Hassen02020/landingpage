import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadOverview } from "@/lib/server/intelligence"
import { parsePeriod } from "@/lib/server/stats"
import { MIN_BOOKINGS } from "@/lib/intelligence"
import { DataGuard } from "../_components/DataGuard"
import { formatTnd } from "@/app/admin/format"

export const dynamic = "force-dynamic"

const tnd = (n: number) => formatTnd(n)
const TONE = { critical: "bg-red-50 border-red-200 text-red-900", warn: "bg-amber-50 border-amber-200 text-amber-900", info: "bg-blue-50 border-blue-200 text-blue-900" } as const

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="text-2xl font-black [overflow-wrap:anywhere]">{value}</div>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  )
}

export default async function IntelligenceOverview({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "reports.view")) return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux responsables.</p>
  const period = parsePeriod(searchParams.from, searchParams.to, 30)
  const d = await loadOverview(period, can(staff.orgRole, "ads.view"))
  const preset = (days: number) => { const p = parsePeriod(undefined, undefined, days); return `/admin/intelligence?from=${p.from}&to=${p.to}` }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Intelligence : vue d&apos;ensemble</h1>
        <p className="text-sm text-gray-600">Ce que les données de la période permettent de dire, et rien de plus. Observé uniquement : aucune estimation ni prévision sur cette page.</p>
      </div>

      <form className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">Du<input type="date" name="from" defaultValue={period.from} className="border rounded-lg px-2 py-1.5" /></label>
        <label className="flex flex-col">Au<input type="date" name="to" defaultValue={period.to} className="border rounded-lg px-2 py-1.5" /></label>
        <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-lg">Afficher</button>
        <div className="flex gap-2 text-xs">{[7, 30, 90].map((n) => <Link key={n} href={preset(n)} className="border rounded-lg px-2 py-1.5 hover:bg-gray-50">{n} j</Link>)}</div>
      </form>

      {d.alerts.length > 0 && (
        <ul className="space-y-2" aria-label="Alertes" data-testid="alerts">
          {d.alerts.map((a) => <li key={a.key} className={`rounded-2xl border p-3 text-sm ${TONE[a.severity]}`}>{a.text}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card label="Leads reçus" value={String(d.leads)} />
        <Card label="Qualifiés" value={String(d.qualified)} note="a atteint « qualifié » ou plus loin" />
        <Card label="Réservés" value={String(d.bookings)} note="a atteint « réservé » ou plus loin" />
        <Card label="Dépenses publicitaires" value={d.spend === null ? "—" : tnd(d.spend)} note={d.spend === null ? "Réservé aux comptes autorisés" : "saisies dans Rentabilité"} />
        <Card label="Marge nette confirmée" value={d.marginConfirmed === null ? "—" : tnd(d.marginConfirmed)} note={d.marginConfirmed === null ? "Réservé aux comptes autorisés" : "commissions confirmées − publicité − coûts"} />
      </div>
      <DataGuard n={d.bookings} min={MIN_BOOKINGS} noun="réservation(s)" period={period} />

      <section className="bg-white rounded-2xl border border-gray-100 p-4" aria-label="Entonnoir">
        <h2 className="font-bold mb-2">Entonnoir de la période</h2>
        <ul className="divide-y text-sm">
          {d.funnel.map((s) => <li key={s.key} className="py-1.5 flex justify-between"><span>{s.label}</span><strong>{s.count}</strong></li>)}
        </ul>
      </section>

      <nav className="grid sm:grid-cols-2 gap-3 text-sm" aria-label="Approfondir">
        <Link href="/admin/intelligence/qualite" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Qualité des données : ce qui manque ou fausse les analyses →</Link>
        {d.financeIncluded && <Link href="/admin/rentabilite/analyse" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Rentabilité par campagne, produit, niche →</Link>}
        <Link href="/admin/stats" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Statistiques marketing, équipe, entonnoir →</Link>
        <Link href="/admin/segments" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Segments de clients →</Link>
      </nav>
    </div>
  )
}
