import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadQuality } from "@/lib/server/intelligence"
import { retryConversionsAction } from "../../../actions"
import { parsePeriod } from "@/lib/server/stats"

export const dynamic = "force-dynamic"

const TONE = { critical: "border-red-200 bg-red-50", warn: "border-amber-200 bg-amber-50", info: "border-gray-200 bg-white" } as const
const BADGE = { critical: "bg-red-600 text-white", warn: "bg-amber-500 text-white", info: "bg-gray-500 text-white" } as const
const LABEL = { critical: "À corriger", warn: "À vérifier", info: "Information" } as const

export default async function QualityPage({ searchParams }: { searchParams: { from?: string; to?: string; ok?: string; erreur?: string } }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "reports.view")) return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux responsables.</p>
  const period = parsePeriod(searchParams.from, searchParams.to, 30)
  const q = await loadQuality(period, can(staff.orgRole, "ads.view"))
  const preset = (days: number) => { const p = parsePeriod(undefined, undefined, days); return `/admin/intelligence/qualite?from=${p.from}&to=${p.to}` }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/intelligence" className="text-sm text-brand-700 font-semibold">← Vue d&apos;ensemble</Link>
        <h1 className="text-2xl font-black mt-1">Qualité des données</h1>
        <p className="text-sm text-gray-600">Les analyses ne valent que ce que valent les données. Cette page liste ce qui manque ou peut fausser les chiffres. Comptages seulement : aucun nom ni numéro n&apos;est affiché.</p>
      </div>

      <form className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">Du<input type="date" name="from" defaultValue={period.from} className="border rounded-lg px-2 py-1.5" /></label>
        <label className="flex flex-col">Au<input type="date" name="to" defaultValue={period.to} className="border rounded-lg px-2 py-1.5" /></label>
        <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-lg">Afficher</button>
        <div className="flex gap-2 text-xs">{[7, 30, 90].map((n) => <Link key={n} href={preset(n)} className="border rounded-lg px-2 py-1.5 hover:bg-gray-50">{n} j</Link>)}</div>
      </form>

      <p className="text-sm text-gray-700" data-testid="quality-total">
        <strong>{q.total}</strong> lead(s) analysé(s) du {period.from} au {period.to}
        {q.excludedTests > 0 ? ` — ${q.excludedTests} lead(s) de test exclu(s)` : ""}.
        {q.truncated && <span className="text-amber-700"> Résultat tronqué à 10 000 leads : réduisez la période.</span>}
      </p>

      {searchParams.ok && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm" data-testid="retry-result">{searchParams.ok}</div>}
      {searchParams.erreur && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{searchParams.erreur}</div>}
      {q.issues.some((i) => i.key === "conversions_failed") && (
        <form action={retryConversionsAction} data-testid="retry-form">
          <button className="bg-brand-700 text-white font-bold px-4 py-2 rounded-lg text-sm">Relancer maintenant les conversions Meta</button>
        </form>
      )}

      {q.issues.length === 0 ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 text-green-900 p-4 text-sm" data-testid="quality-ok">Aucun problème détecté sur les contrôles disponibles pour cette période.</p>
      ) : (
        <ul className="space-y-3" data-testid="quality-issues">
          {q.issues.map((i) => (
            <li key={i.key} data-issue={i.key} className={`rounded-2xl border p-4 ${TONE[i.severity]}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${BADGE[i.severity]}`}>{LABEL[i.severity]}</span>
                <strong className="[overflow-wrap:anywhere]">{i.label}</strong>
                <span className="ml-auto font-black">{i.count}{i.total > 0 ? <span className="text-xs font-normal text-gray-600"> / {i.total}</span> : null}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{i.hint}</p>
            </li>
          ))}
        </ul>
      )}

      {q.unavailable.length > 0 && (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-4" aria-label="Contrôles non disponibles" data-testid="quality-unavailable">
          <h2 className="font-bold text-sm mb-2">Contrôles non disponibles pour l&apos;instant</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            {q.unavailable.map((u) => <li key={u.key}><strong>{u.label}</strong> : {u.reason}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
