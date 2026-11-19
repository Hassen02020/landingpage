import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadExecutive } from "@/lib/server/intelligence"
import { parsePeriod } from "@/lib/server/stats"
import type { Reliability } from "@/lib/executive"

export const dynamic = "force-dynamic"

const BADGE: Record<Reliability, { label: string; cls: string }> = {
  exacte: { label: "Chiffre exact", cls: "bg-green-100 text-green-800" },
  partielle: { label: "Partiel", cls: "bg-amber-100 text-amber-800" },
  indisponible: { label: "Non disponible", cls: "bg-gray-100 text-gray-700" },
}

export default async function ExecutivePage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "reports.view")) return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux responsables.</p>
  const period = parsePeriod(searchParams.from, searchParams.to, 30)
  const d = await loadExecutive(period, can(staff.orgRole, "ads.view"))
  const preset = (days: number) => { const p = parsePeriod(undefined, undefined, days); return `/admin/intelligence/dirigeant?from=${p.from}&to=${p.to}` }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Tableau dirigeant : les cinq questions</h1>
        <p className="text-sm text-gray-600">Une réponse par question, avec sa fiabilité. Quand une donnée manque, la page le dit au lieu d&apos;afficher un chiffre trompeur.</p>
      </div>

      <form className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">Du<input type="date" name="from" defaultValue={period.from} className="border rounded-lg px-2 py-1.5" /></label>
        <label className="flex flex-col">Au<input type="date" name="to" defaultValue={period.to} className="border rounded-lg px-2 py-1.5" /></label>
        <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-lg">Afficher</button>
        <div className="flex gap-2 text-xs">{[7, 30, 90].map((n) => <Link key={n} href={preset(n)} className="border rounded-lg px-2 py-1.5 hover:bg-gray-50">{n} j</Link>)}</div>
      </form>

      <ol className="space-y-3" data-testid="executive-answers">
        {d.answers.map((a) => (
          <li key={a.n} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 min-w-0" data-testid={`answer-${a.n}`} data-reliability={a.reliability}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-bold text-gray-800 min-w-0">{a.n}. {a.question}</h2>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${BADGE[a.reliability].cls}`}>{BADGE[a.reliability].label}</span>
            </div>
            <div className="mt-1 text-3xl font-black [overflow-wrap:anywhere]">{a.value}</div>
            <p className="mt-1 text-sm text-gray-600">{a.note}</p>
          </li>
        ))}
      </ol>

      <nav className="grid sm:grid-cols-2 gap-3 text-sm" aria-label="Approfondir">
        <Link href="/admin/intelligence/qualite" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Qualité des données : ce qui manque →</Link>
        {d.financeIncluded && <Link href="/admin/rentabilite/analyse" className="bg-white rounded-2xl border p-4 font-semibold hover:bg-gray-50">Rentabilité détaillée →</Link>}
      </nav>
    </div>
  )
}
