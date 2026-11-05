import Link from "next/link"
import { dbConfigured } from "@/lib/server/db"
import { loadAllCustomers } from "@/lib/server/customer"
import { SEGMENTS, evaluate, getSegment, idleDays } from "@/lib/segments"
import { STATUS_LABELS } from "@/lib/status"
import { formatDate } from "../../format"

export const dynamic = "force-dynamic"

export default async function SegmentsPage({ searchParams }: { searchParams: { s?: string } }) {
  if (!dbConfigured()) return <p className="text-red-700">Base non configurée.</p>
  const customers = await loadAllCustomers().catch(() => [])
  const now = Date.now()
  const results = evaluate(customers, now)
  const current = getSegment(searchParams.s)
  const shown = current ? results.find((r) => r.segment.slug === current.slug)! : null
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Segments</h1>
        <p className="text-sm text-gray-500">Listes calculées à partir des clients. <b>Rien n&apos;est envoyé</b> : aucune campagne, aucun message automatique. Les segments « marketing » excluent tout client qui a refusé ou retiré son consentement marketing.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="segments">
        {results.map((r) => (
          <Link key={r.segment.slug} href={`/admin/segments?s=${r.segment.slug}`} data-segment={r.segment.slug} className={`bg-white rounded-2xl shadow-sm p-4 border ${current?.slug === r.segment.slug ? "border-gray-900" : "border-transparent"}`}>
            <div className="flex items-baseline justify-between"><span className="font-bold">{r.segment.label}</span><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{r.segment.kind === "marketing" ? "marketing" : "suivi"}</span></div>
            <div className="text-3xl font-black mt-1"><span data-count>{r.eligible.length}</span></div>
            <p className="text-xs text-gray-500">{r.segment.description}</p>
            {r.excluded > 0 && <p className="text-xs text-amber-700 mt-1">{r.excluded} exclu(s) : pas de consentement marketing</p>}
          </Link>
        ))}
      </div>
      {shown && (
        <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <h2 className="font-bold p-4 pb-0">{shown.segment.label} — {shown.eligible.length} contactable(s)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b"><tr><th className="p-3">Client</th><th className="p-3">Statut</th><th className="p-3">Région</th><th className="p-3">Inactif depuis</th><th className="p-3">Dernière activité</th></tr></thead>
            <tbody data-testid="segment-members">
              {shown.eligible.map((c) => (
                <tr key={c.phone} data-phone={c.phone} className="border-b last:border-0">
                  <td className="p-3"><Link className="font-bold underline" href={`/admin/clients/${c.phone}`}>{c.name}</Link><div className="text-xs text-gray-500">+{c.phone}</div></td>
                  <td className="p-3">{STATUS_LABELS[c.lastStatus]}</td>
                  <td className="p-3">{c.region ?? "—"}</td>
                  <td className="p-3">{idleDays(c, now)} j</td>
                  <td className="p-3">{formatDate(c.lastActivityAt)}</td>
                </tr>
              ))}
              {!shown.eligible.length && <tr><td colSpan={5} className="p-6 text-center text-gray-500">Aucun client dans ce segment.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
