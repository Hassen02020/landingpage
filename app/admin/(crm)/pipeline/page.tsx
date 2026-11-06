import Link from "next/link"
import { PRODUCTS, type Product } from "@/lib/config"
import { currentStaff } from "@/lib/server/auth"
import { select } from "@/lib/server/db"
import { UUID_RE, listStaff, type LeadRow } from "@/lib/server/crm"
import { NEXT_STAGE, OPEN_STATUSES, STATUSES, STATUS_LABELS, inFilter, isBooking, isOpen, type Status } from "@/lib/status"
import { moveLeadAction } from "../../actions"

export const dynamic = "force-dynamic"

// Une colonne par statut, dans l'ordre du pipeline commercial (lib/status.ts).
const TONES: Record<Status, string> = {
  nouveau: "border-blue-400",
  a_contacter: "border-sky-400",
  contacte: "border-amber-400",
  a_qualifier: "border-orange-400",
  qualifie: "border-purple-400",
  devis: "border-indigo-400",
  negociation: "border-fuchsia-400",
  reserve: "border-green-500",
  gagne: "border-emerald-600",
  perdu: "border-red-400",
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
    select<Card>("landing_leads", `${filters.join("&")}&or=(status.${inFilter(OPEN_STATUSES)},updated_at.gte.${since})`).catch(() => null),
    listStaff().catch(() => []),
  ])
  const name = new Map(staff.map((s) => [s.user_id, s.full_name || s.email.split("@")[0]]))
  const back = `/admin/pipeline${searchParams.product || searchParams.assigned ? `?${new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][])}` : ""}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Pipeline</h1>
        <form className="flex gap-2 text-sm">
          <select name="product" defaultValue={searchParams.product ?? ""} className="border rounded-lg px-2 py-1.5">
            <option value="">Tous produits</option>
            {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="assigned" defaultValue={searchParams.assigned ?? ""} className="border rounded-lg px-2 py-1.5">
            <option value="">Toute l&apos;équipe</option>
            <option value="me">Mes leads</option>
            <option value="none">Non assignés</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
          </select>
          <button className="bg-gray-900 text-white font-bold px-3 py-1.5 rounded-lg">Filtrer</button>
        </form>
      </div>
      {!cards ? (
        <p className="text-red-700">Lecture impossible.</p>
      ) : (
        <div className="flex gap-3 items-start overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0" data-testid="pipeline-board">
          {COLUMNS.map((col) => {
            const list = cards.filter((c) => c.status === col.status)
            const total = list.reduce((a, c) => a + (Number(c.booking_value) || 0), 0)
            return (
              <section key={col.status} data-status={col.status} className={`bg-gray-100 rounded-2xl p-2 border-t-4 shrink-0 w-64 ${col.tone}`}>
                <h2 className="font-black px-2 py-1 flex justify-between">
                  <span>{STATUS_LABELS[col.status]}</span>
                  <span className="text-gray-500">{list.length}</span>
                </h2>
                {isBooking(col.status) && total > 0 && <p className="px-2 text-xs text-green-700 font-bold">{new Intl.NumberFormat("fr-FR").format(total)} TND</p>}
                {!isOpen(col.status) && <p className="px-2 text-xs text-gray-500">30 derniers jours</p>}
                <div className="space-y-2 mt-2 max-h-[70vh] overflow-y-auto">
                  {list.slice(0, 100).map((c) => {
                    const late = c.next_follow_up_at && Date.parse(c.next_follow_up_at) <= Date.now() && isOpen(c.status)
                    return (
                      <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm text-sm">
                        <Link href={`/admin/leads/${c.id}`} className="font-bold hover:underline">{c.first_name} {c.last_name ?? ""}</Link>
                        <div className="text-xs text-gray-500">{c.ref} · {PRODUCTS[c.product as Product]} · il y a {age(c.created_at)}</div>
                        {c.offer && <div className="text-xs text-gray-700 truncate">{c.offer}</div>}
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className={c.assigned_to ? "text-gray-600" : "text-amber-600"}>{c.assigned_to ? name.get(c.assigned_to) ?? "—" : "non assigné"}</span>
                          {late && <span className="text-red-600 font-bold">relance échue</span>}
                        </div>
                        {(() => {
                          const next = NEXT_STAGE[col.status]
                          return (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {next && (isBooking(next) ? (
                                <Link href={`/admin/leads/${c.id}`} className="text-xs border border-green-300 text-green-700 rounded-lg px-2 py-0.5" title="Le montant est obligatoire : se fait sur la fiche">→ {STATUS_LABELS[next]} (montant)</Link>
                              ) : (
                                <form action={moveLeadAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="hidden" name="status" value={next} />
                                  <input type="hidden" name="back" value={back} />
                                  <button className="text-xs border rounded-lg px-2 py-0.5 hover:bg-gray-50">→ {col.status === "perdu" ? "Rouvrir" : STATUS_LABELS[next]}</button>
                                </form>
                              ))}
                              {isOpen(col.status) && (
                                <form action={moveLeadAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="hidden" name="status" value="perdu" />
                                  <input type="hidden" name="back" value={back} />
                                  <button className="text-xs border rounded-lg px-2 py-0.5 hover:bg-red-50 text-red-700">Perdu</button>
                                </form>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                  {list.length === 0 && <p className="text-xs text-gray-500 px-2 py-4 text-center">Aucun lead</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
