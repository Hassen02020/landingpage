import Link from "next/link"
import { PRODUCTS } from "@/lib/config"
import { can } from "@/lib/permissions"
import { dbConfigured } from "@/lib/server/db"
import { currentStaff } from "@/lib/server/auth"
import { PAGE_SIZE, STATUSES, STATUS_LABELS, listLeads, listStaff, type LeadRow } from "@/lib/server/crm"
import { isBooking, isOpen } from "@/lib/status"
import { loadDashboard, type Dashboard } from "@/lib/server/dashboard"
import { formatDate, formatTnd } from "../format"
import { bulkAction } from "../actions"
import { SelectAll } from "./_components/SelectAll"
import { EmptyState, FilterChip, KpiCard, Notice, PageHeader, fieldCls, primaryBtnCls } from "./_components/ui"
import { StatusBadge } from "./_components/ui"

export const dynamic = "force-dynamic"

type Search = { status?: string; product?: string; channel?: string; q?: string; followUp?: string; assigned?: string; open?: string; page?: string; erreur?: string; ok?: string }

const tnd = (n: number) => formatTnd(n)

export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  if (!dbConfigured()) return <Notice tone="error">Base non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_SERVICE_ROLE_KEY).</Notice>
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
  const seesAll = can(me?.orgRole, "leads.view_all") // employé : uniquement ses dossiers (décision Q8-A)
  const title =
    searchParams.followUp === "due" ? "Relances à faire" : searchParams.assigned === "me" ? "Mes leads" : searchParams.assigned === "none" ? "Leads non assignés" : "Leads"
  const chip = (href: string, label: string, active: boolean) => <FilterChip href={href} label={label} active={active} />
  // filtres actifs : une puce par filtre, retirable d'un clic (l'adresse reste la source de vérité)
  const FILTER_NAMES: Record<string, string> = { q: "Recherche", status: "Statut", product: "Produit", channel: "Canal", assigned: "Responsable", followUp: "Relance", open: "Dossiers" }
  const filterValue = (k: string, v: string) =>
    k === "status" ? v.split(",").map((x) => STATUS_LABELS[x as keyof typeof STATUS_LABELS] ?? x).join(", ")
    : k === "product" ? PRODUCTS[v as keyof typeof PRODUCTS] ?? v
    : k === "assigned" ? (v === "me" ? "Moi" : v === "none" ? "Non assignés" : staffName.get(v) ?? v)
    : k === "followUp" ? "à faire" : k === "open" ? "ouverts" : v
  const withoutFilter = (k: string) => { const u = new URLSearchParams(params.filter(([n]) => n !== k)); return `/admin${u.toString() ? `?${u}` : ""}` }
  return (
    <div className="space-y-4">
      {dash && (
        <section aria-label="Synthèse de l'activité" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard href="/admin?status=nouveau,a_contacter" value={dash.toTreat} label="À traiter" hint="Nouveaux et à contacter" tone="brand" />
          <KpiCard href="/admin" value={dash.today} label="Reçus aujourd'hui" tone="neutral" />
          <KpiCard href="/admin?followUp=due" value={dash.overdue} label="Relances échues" hint={dash.overdue ? "À relancer maintenant" : undefined} tone={dash.overdue ? "danger" : "neutral"} />
          <KpiCard href="/admin?assigned=me&open=1" value={dash.mine} label="Mes dossiers ouverts" tone="neutral" />
          {seesAll && <KpiCard href="/admin?assigned=none&open=1" value={dash.unassigned} label="Non assignés" hint={dash.unassigned ? "À attribuer" : undefined} tone={dash.unassigned ? "attention" : "neutral"} />}
          <KpiCard href="/admin?status=reserve,gagne" value={dash.bookedMonth} label={seesAll ? "Réservés ce mois" : "Mes réservations ce mois"} hint={`${tnd(dash.revenueMonth)} · montants saisis`} tone="success" />
        </section>
      )}

      <PageHeader
        title={title}
        description={!failed && leads.length > 0 ? `${leads.length} lead${leads.length > 1 ? "s" : ""} affiché${leads.length > 1 ? "s" : ""}${leads.length === PAGE_SIZE || page > 0 ? ` · page ${page + 1}` : ""}` : undefined}
        actions={
          <>
            {chip("/admin", "Tous", !params.length)}
            {chip("/admin?assigned=me&open=1", "Mes leads", searchParams.assigned === "me")}
            {seesAll && chip("/admin?assigned=none&open=1", "Non assignés", searchParams.assigned === "none")}
            {chip("/admin?followUp=due", "Relances", searchParams.followUp === "due")}
            {chip("/admin/pipeline", "Vue pipeline →", false)}
          </>
        }
      />
      {searchParams.erreur && <Notice tone="error">Lead introuvable.</Notice>}
      {searchParams.ok && <Notice tone="success">{searchParams.ok}</Notice>}
      {params.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs">
          {params.map(([k, v]) => (
            <li key={k}>
              <Link href={withoutFilter(k)} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-900 hover:bg-brand-200" aria-label={`Retirer le filtre ${FILTER_NAMES[k] ?? k} : ${filterValue(k, v)}`}>
                {FILTER_NAMES[k] ?? k} : {filterValue(k, v)} <span aria-hidden="true">×</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm" method="get" role="search" aria-label="Filtrer les leads">
        <input name="q" defaultValue={searchParams.q} placeholder="Nom, téléphone ou E2B-…" aria-label="Recherche" className={`${fieldCls} min-w-[180px] flex-1`} />
        <select name="status" aria-label="Statut" defaultValue={searchParams.status || ""} className={fieldCls}>
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="product" aria-label="Produit" defaultValue={searchParams.product || ""} className={fieldCls}>
          <option value="">Tous produits</option>
          {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="channel" aria-label="Canal" defaultValue={searchParams.channel || ""} className={fieldCls}>
          <option value="">Tous canaux</option>
          {["meta", "tiktok", "whatsapp", "google", "organic", "referral", "direct"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {seesAll && (
          <select name="assigned" aria-label="Responsable" defaultValue={searchParams.assigned || ""} className={fieldCls}>
          <option value="">Tous responsables</option>
          <option value="me">Moi</option>
          <option value="none">Non assignés</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
        </select>
        )}
        {searchParams.followUp && <input type="hidden" name="followUp" value={searchParams.followUp} />}
        {searchParams.open && <input type="hidden" name="open" value={searchParams.open} />}
        <button className={primaryBtnCls}>Filtrer</button>
      </form>

      {failed ? (
        <Notice tone="error">Lecture des leads impossible. Vérifiez la configuration de la base, puis rechargez la page.</Notice>
      ) : leads.length === 0 ? (
        <EmptyState title="Aucun lead pour ces critères">{params.length > 0 ? <>Retirez un filtre ci-dessus ou <Link href="/admin" className="font-semibold text-brand-700 underline">affichez tous les leads</Link>.</> : "Les nouvelles demandes apparaîtront ici dès leur réception."}</EmptyState>
      ) : (
        <form id="bulk-form" action={bulkAction} className="space-y-2">
          <input type="hidden" name="back" value={here} />
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border text-sm">
            <span className="text-gray-600 px-1">Sélection :</span>
            <select name="bulk" aria-label="Action groupée" defaultValue="" className="px-2 py-1.5 rounded-lg border">
              <option value="" disabled>Action groupée…</option>
              <optgroup label="Assigner">
                <option value="assign:me">À moi</option>
                {staff.map((s) => <option key={s.user_id} value={`assign:${s.user_id}`}>À {s.full_name || s.email}</option>)}
                <option value="assign:none">Retirer le responsable</option>
              </optgroup>
              <optgroup label="Statut">
                {STATUSES.filter((st) => !isBooking(st)).map((st) => <option key={st} value={`status:${st}`}>{STATUS_LABELS[st]}</option>)}
              </optgroup>
            </select>
            <button className="px-3 py-1.5 rounded-lg bg-gray-900 text-white font-bold">Appliquer</button>
            <span className="text-xs text-gray-500">« Réservé » et « Gagné » se font sur la fiche (montant obligatoire).</span>
          </div>
          <div tabIndex={0} role="region" aria-label="Liste des leads (défilement horizontal)" className="relative overflow-x-auto bg-white rounded-2xl shadow-sm">
            <table className="w-full text-sm">
              <caption className="sr-only">Liste des leads</caption>
              <thead className="text-left text-gray-600 border-b">
                <tr>
                  <th scope="col" className="p-3 w-8"><SelectAll form="bulk-form" /></th>
                  <th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Réf.</th><th scope="col" className="p-3">Prospect</th><th scope="col" className="p-3">Produit</th>
                  <th scope="col" className="p-3">Statut</th><th scope="col" className="p-3">Responsable</th><th scope="col" className="p-3">Canal / campagne</th><th scope="col" className="p-3">Relance</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const late = l.next_follow_up_at && Date.parse(l.next_follow_up_at) <= Date.now() && isOpen(l.status)
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3"><input type="checkbox" name="ids" value={l.id} aria-label={`Sélectionner ${l.ref}`} /></td>
                      <td className="p-3 whitespace-nowrap">{formatDate(l.created_at)}</td>
                      <td className="p-3 font-mono whitespace-nowrap"><Link href={`/admin/leads/${l.id}`} className="text-brand-700 underline">{l.ref}</Link></td>
                      <td className="p-3 [overflow-wrap:anywhere] max-w-[16rem]">{l.first_name} {l.last_name ?? ""}{l.is_test && <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-800 text-white text-[10px] font-bold" data-testid="test-badge">TEST</span>}<div className="text-gray-500">{l.phone ? `+${l.phone}` : "—"}</div></td>
                      <td className="p-3">{PRODUCTS[l.product]}<div className="text-gray-500 truncate max-w-[200px]">{l.offer ?? ""}</div></td>
                      <td className="p-3"><StatusBadge status={l.status} /></td>
                      <td className="p-3 whitespace-nowrap">{l.assigned_to ? staffName.get(l.assigned_to) ?? "—" : <span className="text-amber-700">non assigné</span>}</td>
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
