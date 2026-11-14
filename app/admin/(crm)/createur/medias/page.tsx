import Link from "next/link"
import { builderAccess, listMedia } from "@/lib/server/page-builder"

export const dynamic = "force-dynamic"

export default async function MediaLibrary() {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  const media = await listMedia().catch(() => null)
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/createur" className="text-sm text-violet-700 font-semibold">← Mes pages</Link>
        <h1 className="text-2xl font-black mt-1">Médiathèque</h1>
        <p className="text-gray-600 text-sm max-w-2xl">Les images déjà utilisées par vos pages et vos offres. Pour en ajouter une, téléversez-la dans l&apos;éditeur d&apos;une page (JPG, PNG ou WebP, 4 Mo maximum) : elle apparaît ici dès qu&apos;elle est enregistrée sur une page ou une offre, et vous pouvez la réutiliser sans la renvoyer.</p>
      </div>
      {media === null ? (
        <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">Lecture du catalogue impossible pour le moment.</p>
      ) : media.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center text-gray-600" data-testid="media-empty">Aucune image pour l&apos;instant.</div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="media-grid">
          {media.map((m) => (
            <li key={m.url} className="bg-white rounded-2xl border overflow-hidden" data-testid="media-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="w-full h-36 object-cover bg-gray-100" loading="lazy" />
              <div className="p-3 space-y-1">
                <ul className="text-xs text-gray-700 space-y-0.5">{m.uses.slice(0, 3).map((u) => <li key={u} className="truncate" title={u}>{u}</li>)}{m.uses.length > 3 && <li className="text-gray-400">+ {m.uses.length - 3} autre(s)</li>}</ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
