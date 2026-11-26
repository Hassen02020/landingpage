import Link from "next/link"
import { dbConfigured } from "@/lib/server/db"
import { listCustomers } from "@/lib/server/customer"
import { LoadError } from "../_components/LoadError"
import { TIER_COLORS, TIER_LABELS } from "@/lib/loyalty"
import { formatDate, formatTnd } from "../../format"
import { Notice, PageHeader, StatusBadge, fieldCls, primaryBtnCls } from "../_components/ui"

export const dynamic = "force-dynamic"

const tnd = (n: number) => formatTnd(n)

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  if (!dbConfigured()) return <Notice tone="error">Base non configurée.</Notice>
  const page = Math.max(0, parseInt(searchParams.page || "0", 10) || 0)
  // un échec de chargement n'est PAS un état vide : on l'affiche comme une erreur
  let customers: Awaited<ReturnType<typeof listCustomers>> = []
  let failed = false
  try {
    customers = await listCustomers(searchParams.q, page)
  } catch {
    failed = true
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Clients" description="Un client = toutes les demandes d'un même numéro de téléphone. Les dossiers anonymisés n'apparaissent pas." />
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={searchParams.q} placeholder="Nom ou téléphone" aria-label="Rechercher un client" className={`${fieldCls} min-w-0 max-w-sm flex-1`} />
        <button className={primaryBtnCls}>Chercher</button>
      </form>
      {failed ? <LoadError what="les clients" /> : (
      <div tabIndex={0} role="region" aria-label="Liste des clients (défilement horizontal)" className="relative bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Liste des clients</caption>
          <thead className="text-left text-gray-600 border-b">
            <tr><th scope="col" className="p-3">Client</th><th scope="col" className="p-3">Demandes</th><th scope="col" className="p-3">Dernier statut</th><th scope="col" className="p-3">Ventes</th><th scope="col" className="p-3">CA</th><th scope="col" className="p-3">Niveau</th><th scope="col" className="p-3">Marketing</th><th scope="col" className="p-3">Dernière activité</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.phone} data-phone={c.phone} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 max-w-[16rem]"><Link href={`/admin/clients/${c.phone}`} className="font-bold underline [overflow-wrap:anywhere]">{c.name}</Link><div className="text-xs text-gray-600">+{c.phone}</div></td>
                <td className="p-3">{c.leads}{c.openLeads ? <span className="text-xs text-gray-600"> ({c.openLeads} en cours)</span> : null}</td>
                <td className="p-3"><StatusBadge status={c.lastStatus} /></td>
                <td className="p-3">{c.booked}</td>
                <td className="p-3">{c.revenue ? tnd(c.revenue) : "—"}</td>
                <td className="p-3" data-tier={c.tier ?? ""}>{c.tier ? <span className={`px-2 py-1 rounded-full text-xs font-bold ${TIER_COLORS[c.tier]}`}>{TIER_LABELS[c.tier]}</span> : "—"}</td>
                <td className="p-3">{c.marketingOk ? "Accord" : "Non"}</td>
                <td className="p-3">{formatDate(c.lastActivityAt)}</td>
              </tr>
            ))}
            {!customers.length && <tr><td colSpan={8} className="p-6 text-center text-gray-600">Aucun client.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
      <div className="flex gap-3 text-sm">
        {page > 0 && <Link className="underline" href={`/admin/clients?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(page - 1) })}`}>← Précédent</Link>}
        {customers.length === 50 && <Link className="underline" href={`/admin/clients?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(page + 1) })}`}>Suivant →</Link>}
      </div>
    </div>
  )
}
