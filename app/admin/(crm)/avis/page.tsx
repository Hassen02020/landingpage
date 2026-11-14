import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listForAdmin, type ReviewStatus } from "@/lib/server/reviews"
import { moderateReviewAction } from "../../avis-actions"

export const dynamic = "force-dynamic"

const TABS: { status: ReviewStatus; label: string }[] = [
  { status: "pending", label: "À valider" },
  { status: "published", label: "Publiés" },
  { status: "rejected", label: "Refusés" },
]
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" })

export default async function AvisPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await currentStaff()
  if (!can(staff?.orgRole, "catalog.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const status = (TABS.find((t) => t.status === searchParams.status)?.status ?? "pending") as ReviewStatus
  const { reviews, tableMissing } = await listForAdmin(status)
  const btn = "px-3 py-1.5 rounded-lg text-sm font-bold"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Avis des visiteurs</h1>
        <p className="text-sm text-gray-600">
          Les avis laissés sur la page Omra arrivent ici « à valider ». <strong>Rien n&apos;est visible par le public tant que vous n&apos;avez pas cliqué sur « Publier ».</strong> La moyenne affichée est calculée sur les avis publiés uniquement.
        </p>
      </div>
      {tableMissing && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">La migration <code>0025_reviews.sql</code> n&apos;est pas encore appliquée dans Supabase.</div>}
      <nav className="flex gap-2" aria-label="Statut des avis">
        {TABS.map((t) => (
          <Link key={t.status} href={`/admin/avis?status=${t.status}`} className={`${btn} ${t.status === status ? "bg-violet-600 text-white" : "bg-white border text-gray-700"}`} aria-current={t.status === status ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {reviews.length === 0 ? (
        <p className="bg-white rounded-2xl p-6 text-sm text-gray-500">Aucun avis dans cette liste.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white rounded-2xl border p-4 flex flex-wrap items-start justify-between gap-3" data-testid="review-row">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500 text-lg" aria-label={`${r.rating} étoiles sur 5`}>{"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span></span>
                  <strong>{r.first_name}</strong>
                  <span className="text-gray-500">· {r.page_key} · {fmt(r.created_at)}</span>
                </div>
                {r.comment ? <p className="mt-2 text-gray-800 whitespace-pre-line break-words" dir="auto">{r.comment}</p> : <p className="mt-2 text-gray-400 text-sm">Sans commentaire.</p>}
              </div>
              <form action={moderateReviewAction} className="flex gap-2">
                <input type="hidden" name="id" value={r.id} />
                {r.status !== "published" && <button name="status" value="published" className={`${btn} bg-green-600 text-white`}>Publier</button>}
                {r.status !== "rejected" && <button name="status" value="rejected" className={`${btn} bg-red-50 text-red-700 border border-red-200`}>{r.status === "published" ? "Retirer" : "Refuser"}</button>}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
