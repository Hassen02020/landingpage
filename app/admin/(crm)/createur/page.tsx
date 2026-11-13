import Link from "next/link"
import { builderAccess, listBuilderPages } from "@/lib/server/page-builder"
import { creatorPath } from "@/lib/page-builder/paths"
import { filterPages, lifecycleOf, normalizeQuery, summarize } from "@/lib/page-builder/dashboard"
import { archiveAction, duplicateAction, restoreAction, unpublishFromListAction } from "@/app/admin/createur-actions"

export const dynamic = "force-dynamic"

const TONE = { ok: "bg-green-100 text-green-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" } as const
const PRODUCTS: Record<string, string> = { omra: "Omra", voyage: "Voyages organisés", hotel: "Hôtels", autre: "Autres produits" }
const TABS = [["toutes", "Actives"], ["brouillon", "Brouillons"], ["publiee", "Publiées"], ["archivee", "Archivées"]] as const
const btn = "px-3 py-2 rounded-lg border text-sm font-bold min-h-[44px] inline-flex items-center"

export default async function CreatorHome({ searchParams }: { searchParams: { vue?: string; q?: string; produit?: string; ok?: string; erreur?: string } }) {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  const all = await listBuilderPages().catch(() => null)
  const query = normalizeQuery(searchParams)
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    const m = { vue: query.vue === "toutes" ? "" : query.vue, q: query.q, produit: query.produit, ...over }
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v)
    const s = p.toString()
    return `/admin/createur${s ? `?${s}` : ""}`
  }
  const sum = all ? summarize(all) : null
  const rows = all ? filterPages(all, query) : []
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Créateur de Landing Pages</h1>
          <p className="text-gray-600 text-sm max-w-2xl">Créez, personnalisez, publiez et promouvez vos pages. Aucun code à écrire.</p>
        </div>
        <Link href="/admin/createur/modeles" className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-3 rounded-xl min-h-[44px]" data-testid="new-page">+ Nouvelle page</Link>
      </div>

      {searchParams.ok && <p role="status" className="bg-green-50 border border-green-200 text-green-900 rounded-xl p-3 text-sm" data-testid="flash-ok">{searchParams.ok}</p>}
      {searchParams.erreur && <p role="alert" className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 text-sm" data-testid="flash-error">{searchParams.erreur}</p>}

      {all === null || sum === null ? (
        <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">Lecture du catalogue impossible pour le moment (migration 0004 appliquée ?).</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpis">
            {[["Pages actives", sum.total, "", "actives"], ["Brouillons", sum.brouillons, "brouillon", "brouillons"], ["Publiées", sum.publiees, "publiee", "publiees"], ["À corriger", sum.aCorriger, "publiee", "a-corriger"]].map(([label, n, vue, id]) => (
              <Link key={String(label)} href={href({ vue: String(vue) })} className="bg-white rounded-2xl border p-4 block">
                <div className="text-3xl font-black" data-testid={`kpi-${id}`}>{n}</div>
                <div className="text-sm text-gray-600">{label}</div>
              </Link>
            ))}
          </div>
          {sum.aCorriger > 0 && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">{sum.aCorriger} page{sum.aCorriger > 1 ? "s" : ""} publiée{sum.aCorriger > 1 ? "s" : ""} ne peut{sum.aCorriger > 1 ? "vent" : ""} pas recevoir de publicité pour le moment (offres expirées ou absentes) : ouvrez-la pour corriger.</p>}

          <nav aria-label="Filtrer les pages" className="flex flex-wrap gap-2">
            {TABS.map(([v, label]) => (
              <Link key={v} href={href({ vue: v === "toutes" ? "" : v })} aria-current={query.vue === v ? "page" : undefined} className={`${btn} ${query.vue === v ? "bg-violet-700 text-white border-violet-700" : "bg-white"}`}>
                {label}{v === "archivee" ? ` (${sum.archivees})` : v === "brouillon" ? ` (${sum.brouillons})` : v === "publiee" ? ` (${sum.publiees})` : ""}
              </Link>
            ))}
          </nav>

          <form method="get" action="/admin/createur" className="flex flex-wrap gap-2" role="search">
            {query.vue !== "toutes" && <input type="hidden" name="vue" value={query.vue} />}
            <input name="q" defaultValue={query.q} placeholder="Rechercher une page (nom, adresse)" aria-label="Rechercher une page" className="flex-1 min-w-[200px] border rounded-xl px-3 py-2 min-h-[44px]" />
            <select name="produit" defaultValue={query.produit} aria-label="Produit" className="border rounded-xl px-3 py-2 min-h-[44px] bg-white">
              <option value="">Tous les produits</option>
              {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={`${btn} bg-white`}>Filtrer</button>
            {(query.q || query.produit) && <Link href={href({ q: "", produit: "" })} className={`${btn} bg-white`}>Effacer</Link>}
          </form>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center text-gray-600" data-testid="empty">
              {all.length === 0 ? "Aucune page pour l'instant. Cliquez sur « Nouvelle page » pour commencer." : "Aucune page ne correspond à ces critères."}
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" data-testid="page-list">
              {rows.map(({ category: c, status, offers }) => {
                const life = lifecycleOf(c)
                return (
                  <li key={c.id} className="bg-white rounded-2xl border p-4 space-y-3" data-testid="page-card" data-slug={c.slug} data-life={life}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-black truncate">{c.name}</h2>
                        <p className="font-mono text-xs text-gray-500 break-all" dir="ltr">{creatorPath(c.slug)}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{PRODUCTS[c.product] ?? c.product}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {life === "archivee" ? <span className="px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-700">Archivée</span>
                        : life === "brouillon" ? <span className="px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-800">Brouillon</span>
                        : <span title={status.detail} className={`px-2 py-0.5 rounded-full font-bold ${TONE[status.tone]}`}>Publiée · {status.label}</span>}
                      <span className="text-gray-500">{offers} offre{offers > 1 ? "s" : ""}</span>
                      <span className="text-gray-400">· modifiée le {c.updated_at.slice(0, 10)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {life !== "archivee" && <Link href={`/admin/createur/${c.id}?etape=infos`} className={`${btn} bg-violet-700 text-white border-violet-700`}>Modifier</Link>}
                      {life === "publiee" && <Link href={creatorPath(c.slug)} target="_blank" rel="noopener" className={btn}>Voir la page</Link>}
                      <form action={duplicateAction}><input type="hidden" name="id" value={c.id} /><button className={btn}>Dupliquer</button></form>
                      {life === "publiee" && <form action={unpublishFromListAction}><input type="hidden" name="id" value={c.id} /><button className={btn}>Désactiver</button></form>}
                      {life === "brouillon" && <form action={archiveAction}><input type="hidden" name="id" value={c.id} /><button className={btn}>Archiver</button></form>}
                      {life === "archivee" && <form action={restoreAction}><input type="hidden" name="id" value={c.id} /><button className={btn}>Restaurer</button></form>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
