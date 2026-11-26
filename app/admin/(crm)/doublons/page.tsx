import Link from "next/link"
import { can, canDecideDuplicate, canReopenDuplicate } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listReviews } from "@/lib/server/duplicates"
import { DUP_RULE_LABELS, DUP_STATUSES, DUP_STATUS_LABELS, type DupStatus } from "@/lib/duplicates"
import { decideDuplicateAction, reopenDuplicateAction } from "../../actions"
import { formatDate } from "../../format"

export const dynamic = "force-dynamic"

export default async function DuplicatesPage({ searchParams }: { searchParams: { statut?: string; ok?: string; erreur?: string } }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "duplicates.review")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux responsables et administrateurs.</p>
  const status = (DUP_STATUSES as readonly string[]).includes(searchParams.statut ?? "") ? (searchParams.statut as DupStatus) : "signale"
  const { reviews, tableMissing } = await listReviews(status)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Doublons de dossiers</h1>
        <p className="text-sm text-gray-600">
          Signalements à confirmer ou rejeter. <strong>Aucun dossier n&apos;est fusionné ni supprimé</strong> : un doublon confirmé n&apos;est plus compté dans les ventes, le chiffre d&apos;affaires, la conversion ni les envois publicitaires, mais reste consultable. Vous ne pouvez pas décider un signalement que vous avez vous-même créé.
        </p>
      </div>
      {tableMissing && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">La migration <code>0030_duplicate_reviews.sql</code> n&apos;est pas encore appliquée dans Supabase.</div>}
      {searchParams.ok && <div role="status" className="p-3 rounded-xl bg-green-50 text-green-800 text-sm">{searchParams.ok}</div>}
      {searchParams.erreur && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{searchParams.erreur}</div>}
      <nav className="flex gap-2" aria-label="Statut">
        {DUP_STATUSES.map((s) => (
          <Link key={s} href={`/admin/doublons?statut=${s}`} aria-current={s === status ? "page" : undefined} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${s === status ? "bg-brand-600 text-white" : "bg-white border text-gray-700"}`}>{DUP_STATUS_LABELS[s]}</Link>
        ))}
      </nav>
      {reviews.length === 0 ? <p className="bg-white rounded-2xl p-6 text-sm text-gray-500">Aucun signalement dans cette liste.</p> : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white rounded-2xl border p-3 text-sm flex flex-wrap items-center gap-2" data-testid="dup-row">
              <Link href={`/admin/leads/${r.lead_id}`} className="font-mono underline">{r.leadRef}</Link> → <Link href={`/admin/leads/${r.primary_lead_id}`} className="font-mono underline">{r.primaryRef}</Link>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{DUP_RULE_LABELS[r.rule]}</span>
              <span className="text-xs text-gray-500">confiance {r.confidence === "elevee" ? "élevée" : "faible"} · {formatDate(r.reported_at)}{r.reason ? ` · ${r.reason}` : ""}</span>
              {r.status === "signale" && canDecideDuplicate(staff.orgRole, staff.userId, r) && (
                <form action={decideDuplicateAction} className="ml-auto flex flex-wrap items-center gap-1">
                  <input type="hidden" name="review_id" value={r.id} />
                  <input name="note" maxLength={300} placeholder="Note de décision (facultatif)" className="px-2 py-1 rounded border text-xs" />
                  <button name="decision" value="confirme" className="text-xs rounded bg-gray-800 text-white px-2 py-1">Confirmer</button>
                  <button name="decision" value="rejete" className="text-xs rounded border px-2 py-1">Rejeter</button>
                </form>
              )}
              {r.status === "signale" && !canDecideDuplicate(staff.orgRole, staff.userId, r) && <span className="ml-auto text-xs text-gray-500">{r.reported_by === staff.userId ? "Signalé par vous : un autre responsable doit décider." : ""}</span>}
              {r.status !== "signale" && canReopenDuplicate(staff.orgRole) && (
                <form action={reopenDuplicateAction} className="ml-auto"><input type="hidden" name="review_id" value={r.id} /><button className="text-xs underline">Rouvrir (administrateur)</button></form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
