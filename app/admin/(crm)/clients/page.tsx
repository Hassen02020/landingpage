import Link from "next/link"
import { dbConfigured } from "@/lib/server/db"
import { listCustomers } from "@/lib/server/customer"
import { STATUS_LABELS } from "@/lib/status"
import { STATUS_COLORS, formatDate } from "../../format"

export const dynamic = "force-dynamic"

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  if (!dbConfigured()) return <p className="text-red-700">Base non configurée.</p>
  const page = Math.max(0, parseInt(searchParams.page || "0", 10) || 0)
  const customers = await listCustomers(searchParams.q, page).catch(() => [])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Clients</h1>
        <p className="text-sm text-gray-500">Un client = toutes les demandes d&apos;un même numéro de téléphone. Les dossiers anonymisés n&apos;apparaissent pas.</p>
      </div>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={searchParams.q} placeholder="Nom ou téléphone" aria-label="Rechercher un client" className="border rounded-xl px-3 py-2 flex-1 max-w-sm" />
        <button className="bg-gray-900 text-white font-bold px-4 rounded-xl">Chercher</button>
      </form>
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr><th className="p-3">Client</th><th className="p-3">Demandes</th><th className="p-3">Dernier statut</th><th className="p-3">Ventes</th><th className="p-3">CA</th><th className="p-3">Marketing</th><th className="p-3">Dernière activité</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.phone} data-phone={c.phone} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3"><Link href={`/admin/clients/${c.phone}`} className="font-bold underline">{c.name}</Link><div className="text-xs text-gray-500">+{c.phone}</div></td>
                <td className="p-3">{c.leads}{c.openLeads ? <span className="text-xs text-gray-500"> ({c.openLeads} en cours)</span> : null}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.lastStatus]}`}>{STATUS_LABELS[c.lastStatus]}</span></td>
                <td className="p-3">{c.booked}</td>
                <td className="p-3">{c.revenue ? tnd(c.revenue) : "—"}</td>
                <td className="p-3">{c.marketingOk ? "Accord" : "Non"}</td>
                <td className="p-3">{formatDate(c.lastActivityAt)}</td>
              </tr>
            ))}
            {!customers.length && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Aucun client.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-sm">
        {page > 0 && <Link className="underline" href={`/admin/clients?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(page - 1) })}`}>← Précédent</Link>}
        {customers.length === 50 && <Link className="underline" href={`/admin/clients?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(page + 1) })}`}>Suivant →</Link>}
      </div>
    </div>
  )
}
