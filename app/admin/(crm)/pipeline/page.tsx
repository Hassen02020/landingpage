import { selectLeadsExcludingDuplicates } from "@/lib/server/lead-scope"
import Link from "next/link"
import { PRODUCTS, type Product } from "@/lib/config"
import { currentStaff } from "@/lib/server/auth"
import { select } from "@/lib/server/db"
import { UUID_RE, listStaff, type LeadRow } from "@/lib/server/crm"
import { NEXT_STAGE, OPEN_STATUSES, STATUSES, STATUS_LABELS, inFilter, isBooking, isOpen, type Status } from "@/lib/status"
import { moveLeadAction } from "../../actions"
import { Notice, PageHeader, fieldCls, primaryBtnCls } from "../_components/ui"

export const dynamic = "force-dynamic"

// Une colonne par statut, dans l'ordre du pipeline commercial (lib/status.ts).
// Filet de colonne : même palette par PHASE que les badges de statut (LOT 1) — à traiter, en cours, vendu, perdu.
const TONES: Record<Status, string> = {
  nouveau: "border-amber-400",
  a_contacter: "border-amber-400",
  contacte: "border-brand-300",
  a_qualifier: "border-brand-300",
  qualifie: "border-brand-500",
  devis: "border-brand-500",
  negociation: "border-brand-700",
  reserve: "border-green-500",
  gagne: "border-green-700",
  perdu: "border-gray-400",
}
const COLUMNS = STATUSES.map((status) => ({ status, tone: TONES[status] }))

const age = (iso: string) => {
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000)
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} j`
}

type Card = Pick<LeadRow, "id" | "ref" | "first_name" | "last_name" | "product" | "offer" | "status" | "created_at" | "next_follow_up_at" | "assigned_to" | "booking_value">

export default async function PipelinePage({ searchParams }: { searchParams: { product?: string; assigned?: string } }) {
  const me = await currentStaff()
  const filters = ["select=id,ref,first_name,last_name,product,offer,status,created_at,next_follow_up_at,assigned_to,booking_value", "anonymized_at=is.null", "order=created_at.desc", "limit=1000"]
  if (searchParams.product && searchParams.product in PRODUCTS) filters.push(`product=eq.${searchParams.product}`)
  if (searchParams.assigned === "me" && me) filters.push(`assigned_to=eq.${me.userId}`)
  else if (searchParams.assigned === "none") filters.push("assigned_to=is.null")
  else if (searchParams.assigned && UUID_RE.test(searchParams.assigned)) filters.push(`assigned_to=eq.${searchParams.assigned}`)
  // dossiers conclus : 30 derniers jours seulement (le tableau reste lisible)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [cards, staff] = await Promise.all([
    selectLeadsExcludingDuplicates<Card>(`${filters.join("&")}&or=(status.${inFilter(OPEN_STATUSES)},updated_at.gte.${since})`).catch(() => null),
    listStaff().catch(() => []),
  ])
  const name = new Map(staff.map((s) => [s.user_id, s.full_name || s.email.split("@")[0]]))
  const back = `/admin/pipeline${searchParams.product || searchParams.assigned ? `?${new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][])}` : ""}`

  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" description="Un dossier par carte, rangé par étape commerciale. Les couleurs suivent les phases : à traiter, en cours, vendu, perdu." actions={
        <form className="flex min-w-0 flex-wrap gap-2 text-sm" role="search" aria-label="Filtrer le pipeline">
          <select name="product" aria-label="Produit" defaultValue={searchParams.product ?? ""} className={`${fieldCls} min-w-0 max-w-full`}>
            <option value="">Tous produits</option>
            {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="assigned" aria-label="Responsable" defaultValue={searchParams.assigned ?? ""} className={`${fieldCls} min-w-0 max-w-full`}>
            <option value="">Toute l&apos;équipe</option>
            <option value="me">Mes leads</option>
            <option value="none">Non assignés</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
          </select>
          <button className={primaryBtnCls}>Filtrer</button>
        </form>
      } />
      {!cards ? (
        <Notice tone="error">Lecture du pipeline impossible. Rechargez la page ; si le problème persiste, vérifiez la base.</Notice>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:overflow-x-auto sm:pb-3" data-testid="pipeline-board">
          {COLUMNS.map((col) => {
            const list = cards.filter((c) => c.status === col.status)
            const total = list.reduce((a, c) => a + (Number(c.booking_value) || 0), 0)
            return (
              <section key={col.status} data-status={col.status} className={`bg-gray-100 rounded-2xl p-2 border-t-4 sm:shrink-0 w-full sm:w-64 ${col.tone} ${list.length === 0 ? "max-sm:hidden" : ""}`}>
                <h2 className="font-black px-2 py-1 flex justify-between">
                  <span>{STATUS_LABELS[col.status]}</span>
                  <span className="text-gray-600">{list.length > 100 ? `100 sur ${list.length}` : list.length}</span>
                </h2>
                {isBooking(col.status) && total > 0 && <p className="px-2 text-xs text-green-700 font-bold">{new Intl.NumberFormat("fr-FR").format(total)} TND</p>}
                {!isOpen(col.status) && <p className="px-2 text-xs text-gray-600">30 derniers jours</p>}
                <div className="space-y-2 mt-2 max-h-[70vh] overflow-y-auto">
                  {list.slice(0, 100).map((c) => {
                    const late = c.next_follow_up_at && Date.parse(c.next_follow_up_at) <= Date.now() && isOpen(c.status)
                    return (
                      <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm text-sm">
                        <Link href={`/admin/leads/${c.id}`} className="font-bold hover:underline [overflow-wrap:anywhere]">{c.first_name} {c.last_name ?? ""}</Link>
                        <div className="text-xs text-gray-600">{c.ref} · {PRODUCTS[c.product as Product]} · il y a {age(c.created_at)}</div>
                        {c.offer && <div className="text-xs text-gray-700 truncate">{c.offer}</div>}
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className={c.assigned_to ? "text-gray-600" : "text-amber-600"}>{c.assigned_to ? name.get(c.assigned_to) ?? "—" : "non assigné"}</span>
                          {late && <span className="text-red-600 font-bold">relance échue</span>}
                        </div>
                        {(() => {
                          const next = NEXT_STAGE[col.status]
                          return (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {next && (isBooking(next) ? (
                                <Link href={`/admin/leads/${c.id}`} className="inline-flex min-h-[44px] items-center text-xs border border-green-300 text-green-800 rounded-lg px-3 py-0.5 sm:min-h-[32px]" title="Le montant est obligatoire : se fait sur la fiche">→ {STATUS_LABELS[next]} (montant)</Link>
                              ) : (
                                <form action={moveLeadAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="hidden" name="status" value={next} />
                                  <input type="hidden" name="back" value={back} />
                                  <button className="min-h-[44px] text-xs border border-gray-300 rounded-lg px-3 py-0.5 hover:bg-gray-50 sm:min-h-[32px]">→ {col.status === "perdu" ? "Rouvrir" : STATUS_LABELS[next]}</button>
                                </form>
                              ))}
                              {isOpen(col.status) && (
                                <form action={moveLeadAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="hidden" name="status" value="perdu" />
                                  <input type="hidden" name="back" value={back} />
                                  <button className="min-h-[44px] text-xs border border-red-200 rounded-lg px-3 py-0.5 hover:bg-red-50 text-red-700 sm:min-h-[32px]">Perdu</button>
                                </form>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                  {list.length === 0 && <p className="text-xs text-gray-600 px-2 py-4 text-center">Aucun lead</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
