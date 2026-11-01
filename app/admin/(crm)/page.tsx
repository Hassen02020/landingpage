import Link from "next/link"
import { PRODUCTS } from "@/lib/config"
import { dbConfigured } from "@/lib/server/db"
import { PAGE_SIZE, STATUSES, STATUS_LABELS, listLeads, type LeadRow } from "@/lib/server/crm"
import { STATUS_COLORS, formatDate } from "../format"

export const dynamic = "force-dynamic"

type Search = { status?: string; product?: string; channel?: string; q?: string; followUp?: string; page?: string; erreur?: string }

export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  if (!dbConfigured()) return <p className="text-red-700">Base non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_SERVICE_ROLE_KEY).</p>
  const page = Math.max(0, parseInt(searchParams.page || "0", 10) || 0)
  let leads: LeadRow[] = []
  let failed = false
  try {
    leads = await listLeads({ ...searchParams, page })
  } catch {
    failed = true
  }
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== "page" && k !== "erreur") as [string, string][])
    u.set("page", String(p))
    return `/admin?${u}`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">{searchParams.followUp === "due" ? "Relances à faire" : "Leads"}</h1>
      {searchParams.erreur && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">Lead introuvable.</div>}

      <form className="flex flex-wrap gap-2 bg-white p-3 rounded-2xl shadow-sm" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Nom, téléphone ou E2B-…" className="px-3 py-2 rounded-lg border flex-1 min-w-[180px]" />
        <select name="status" defaultValue={searchParams.status || ""} className="px-3 py-2 rounded-lg border">
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="product" defaultValue={searchParams.product || ""} className="px-3 py-2 rounded-lg border">
          <option value="">Tous produits</option>
          {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="channel" defaultValue={searchParams.channel || ""} className="px-3 py-2 rounded-lg border">
          <option value="">Tous canaux</option>
          {["meta", "tiktok", "whatsapp", "google", "organic", "referral", "direct"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {searchParams.followUp && <input type="hidden" name="followUp" value={searchParams.followUp} />}
        <button className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold">Filtrer</button>
      </form>

      {failed ? (
        <p className="text-red-700">Lecture des leads impossible. Vérifiez la configuration de la base.</p>
      ) : leads.length === 0 ? (
        <p className="text-gray-500">Aucun lead.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="p-3">Date</th><th className="p-3">Réf.</th><th className="p-3">Prospect</th><th className="p-3">Produit</th>
                <th className="p-3">Statut</th><th className="p-3">Canal / campagne</th><th className="p-3">Relance</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="p-3 font-mono"><Link href={`/admin/leads/${l.id}`} className="text-blue-800 underline">{l.ref}</Link></td>
                  <td className="p-3">{l.first_name} {l.last_name ?? ""}<div className="text-gray-500">{l.phone ? `+${l.phone}` : "—"}</div></td>
                  <td className="p-3">{PRODUCTS[l.product]}<div className="text-gray-500 truncate max-w-[200px]">{l.offer ?? ""}</div></td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span></td>
                  <td className="p-3">{l.channel ?? "—"}<div className="text-gray-500">{l.utm_campaign ?? ""}</div></td>
                  <td className="p-3 whitespace-nowrap">{formatDate(l.next_follow_up_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 text-sm">
        {page > 0 && <Link href={qs(page - 1)} className="underline">← Précédents</Link>}
        {leads.length === PAGE_SIZE && <Link href={qs(page + 1)} className="underline">Suivants →</Link>}
      </div>
    </div>
  )
}
