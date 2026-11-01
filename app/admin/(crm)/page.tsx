import Link from "next/link"
import { PRODUCTS } from "@/lib/config"
import { dbConfigured } from "@/lib/server/db"
import { currentStaff } from "@/lib/server/auth"
import { PAGE_SIZE, STATUSES, STATUS_LABELS, listLeads, listStaff, type LeadRow } from "@/lib/server/crm"
import { loadDashboard, type Dashboard } from "@/lib/server/dashboard"
import { STATUS_COLORS, formatDate } from "../format"
import { bulkAction } from "../actions"
import { SelectAll } from "./_components/SelectAll"

export const dynamic = "force-dynamic"

type Search = { status?: string; product?: string; channel?: string; q?: string; followUp?: string; assigned?: string; open?: string; page?: string; erreur?: string; ok?: string }

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`

function Card({ href, value, label, tone }: { href: string; value: string | number; label: string; tone: string }) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
      <div className={`text-2xl font-black ${tone}`}>{value}</div>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
    </Link>
  )
}

export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  if (!dbConfigured()) return <p className="text-red-700">Base non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_SERVICE_ROLE_KEY).</p>
  const me = await currentStaff()
  const page = Math.max(0, parseInt(searchParams.page || "0", 10) || 0)
  let leads: LeadRow[] = []
  let failed = false
  let dash: Dashboard | null = null
  let staff: { user_id: string; email: string; full_name: string | null }[] = []
  try {
    ;[leads, dash, staff] = await Promise.all([
      listLeads({ ...searchParams, page, me: me?.userId }),
      me ? loadDashboard(me.userId).catch(() => null) : Promise.resolve(null),
      listStaff().catch(() => []),
    ])
  } catch {
    failed = true
  }
  const staffName = new Map(staff.map((s) => [s.user_id, s.full_name || s.email.split("@")[0]]))
  const params = Object.entries(searchParams).filter(([k, v]) => v && !["page", "erreur", "ok"].includes(k)) as [string, string][]
  const qs = (p: number) => {
    const u = new URLSearchParams(params)
    u.set("page", String(p))
    return `/admin?${u}`
  }
  const here = `/admin${params.length ? `?${new URLSearchParams(params)}` : ""}`
  const title =
    searchParams.followUp === "due" ? "Relances à faire" : searchParams.assigned === "me" ? "Mes leads" : searchParams.assigned === "none" ? "Leads non assignés" : "Leads"
  const chip = (href: string, label: string, active: boolean) => (
    <Link href={href} className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}>{label}</Link>
  )

  return (
    <div className="space-y-4">
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card href="/admin?status=nouveau" value={dash.toTreat} label="À traiter" tone="text-blue-700" />
          <Card href="/admin" value={dash.today} label="Reçus aujourd'hui" tone="text-violet-700" />
          <Card href="/admin?followUp=due" value={dash.overdue} label="Relances échues" tone={dash.overdue ? "text-red-600" : "text-gray-900"} />
          <Card href="/admin?assigned=me&open=1" value={dash.mine} label="Mes dossiers ouverts" tone="text-gray-900" />
          <Card href="/admin?assigned=none&open=1" value={dash.unassigned} label="Non assignés" tone={dash.unassigned ? "text-amber-600" : "text-gray-900"} />
          <Card href="/admin?status=reserve" value={dash.bookedMonth} label={`Réservés ce mois · ${tnd(dash.revenueMonth)}`} tone="text-green-700" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{title}</h1>
        <div className="flex flex-wrap gap-2">
          {chip("/admin", "Tous", !params.length)}
          {chip("/admin?assigned=me&open=1", "Mes leads", searchParams.assigned === "me")}
          {chip("/admin?assigned=none&open=1", "Non assignés", searchParams.assigned === "none")}
          {chip("/admin?followUp=due", "Relances", searchParams.followUp === "due")}
          {chip("/admin/pipeline", "Vue pipeline →", false)}
        </div>
      </div>
      {searchParams.erreur && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">Lead introuvable.</div>}
      {searchParams.ok && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm">{searchParams.ok}</div>}

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
        <select name="assigned" defaultValue={searchParams.assigned || ""} className="px-3 py-2 rounded-lg border">
          <option value="">Tous responsables</option>
          <option value="me">Moi</option>
          <option value="none">Non assignés</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
        </select>
        {searchParams.followUp && <input type="hidden" name="followUp" value={searchParams.followUp} />}
        {searchParams.open && <input type="hidden" name="open" value={searchParams.open} />}
        <button className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold">Filtrer</button>
      </form>

      {failed ? (
        <p className="text-red-700">Lecture des leads impossible. Vérifiez la configuration de la base.</p>
      ) : leads.length === 0 ? (
        <p className="text-gray-500">Aucun lead.</p>
      ) : (
        <form id="bulk-form" action={bulkAction} className="space-y-2">
          <input type="hidden" name="back" value={here} />
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border text-sm">
            <span className="text-gray-600 px-1">Sélection :</span>
            <select name="bulk" defaultValue="" className="px-2 py-1.5 rounded-lg border">
              <option value="" disabled>Action groupée…</option>
              <optgroup label="Assigner">
                <option value="assign:me">À moi</option>
                {staff.map((s) => <option key={s.user_id} value={`assign:${s.user_id}`}>À {s.full_name || s.email}</option>)}
                <option value="assign:none">Retirer le responsable</option>
              </optgroup>
              <optgroup label="Statut">
                <option value="status:contacte">Contacté</option>
                <option value="status:qualifie">Qualifié</option>
                <option value="status:perdu">Perdu</option>
              </optgroup>
            </select>
            <button className="px-3 py-1.5 rounded-lg bg-gray-900 text-white font-bold">Appliquer</button>
            <span className="text-xs text-gray-500">« Réservé » se fait sur la fiche (montant obligatoire).</span>
          </div>
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="p-3 w-8"><SelectAll form="bulk-form" /></th>
                  <th className="p-3">Date</th><th className="p-3">Réf.</th><th className="p-3">Prospect</th><th className="p-3">Produit</th>
                  <th className="p-3">Statut</th><th className="p-3">Responsable</th><th className="p-3">Canal / campagne</th><th className="p-3">Relance</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const late = l.next_follow_up_at && Date.parse(l.next_follow_up_at) <= Date.now() && ["nouveau", "contacte", "qualifie"].includes(l.status)
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3"><input type="checkbox" name="ids" value={l.id} aria-label={`Sélectionner ${l.ref}`} /></td>
                      <td className="p-3 whitespace-nowrap">{formatDate(l.created_at)}</td>
                      <td className="p-3 font-mono"><Link href={`/admin/leads/${l.id}`} className="text-blue-800 underline">{l.ref}</Link></td>
                      <td className="p-3">{l.first_name} {l.last_name ?? ""}<div className="text-gray-500">{l.phone ? `+${l.phone}` : "—"}</div></td>
                      <td className="p-3">{PRODUCTS[l.product]}<div className="text-gray-500 truncate max-w-[200px]">{l.offer ?? ""}</div></td>
                      <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span></td>
                      <td className="p-3 whitespace-nowrap">{l.assigned_to ? staffName.get(l.assigned_to) ?? "—" : <span className="text-amber-600">non assigné</span>}</td>
                      <td className="p-3">{l.channel ?? "—"}<div className="text-gray-500">{l.utm_campaign ?? ""}</div></td>
                      <td className={`p-3 whitespace-nowrap ${late ? "text-red-600 font-bold" : ""}`}>{formatDate(l.next_follow_up_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}

      <div className="flex gap-3 text-sm">
        {page > 0 && <Link href={qs(page - 1)} className="underline">← Précédents</Link>}
        {leads.length === PAGE_SIZE && <Link href={qs(page + 1)} className="underline">Suivants →</Link>}
      </div>
    </div>
  )
}
