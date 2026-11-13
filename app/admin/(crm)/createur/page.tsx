import Link from "next/link"
import { builderAccess, listBuilderPages } from "@/lib/server/page-builder"
import { SITE_URL } from "@/lib/config"

export const dynamic = "force-dynamic"

const TONE = { ok: "bg-green-100 text-green-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" } as const

export default async function CreatorHome() {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  const pages = await listBuilderPages().catch(() => null)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Créateur de Landing Pages</h1>
          <p className="text-gray-600 text-sm max-w-2xl">Créez une page professionnelle pour un produit, vérifiez-la, publiez-la, puis copiez le lien publicitaire. Aucun code à écrire.</p>
        </div>
        <Link href="/admin/createur/modeles" className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-3 rounded-xl">+ Nouvelle page</Link>
      </div>
      {pages === null ? (
        <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">Lecture du catalogue impossible pour le moment (migration 0004 appliquée ?).</p>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center text-gray-600">Aucune page pour l&apos;instant. Cliquez sur « Nouvelle page » pour commencer.</div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="p-3">Page</th><th>Adresse publique</th><th>État</th><th className="text-right p-3">Offres</th><th /></tr></thead>
            <tbody>
              {pages.map(({ category: c, status, offers }) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-bold">{c.name}</td>
                  <td className="font-mono text-xs" dir="ltr">{c.slug === "omra-2027" ? "/omra" : `/c/${c.slug}`}</td>
                  <td><span title={status.detail} className={`px-2 py-0.5 rounded-full text-xs font-bold ${TONE[status.tone]}`}>{status.label}</span></td>
                  <td className="text-right p-3">{offers}</td>
                  <td className="p-3 text-right"><Link href={`/admin/createur/${c.id}?etape=infos`} className="text-violet-700 font-bold">Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Adresse du site : <span dir="ltr">{SITE_URL}</span></p>
    </div>
  )
}
