import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { builderAccess, catalogueOffers, loadBuilderPage, loadPageStats } from "@/lib/server/page-builder"
import { THEMES, themeById, familyOf, type Theme } from "@/lib/page-builder/themes"
import { SITE_URL } from "@/lib/config"
import { creatorPath } from "@/lib/page-builder/paths"
import { PageEditor } from "./PageEditor"
import { Stepper } from "./Stepper"
import { ReadinessList } from "./ReadinessList"
import { PreviewPanel } from "./PreviewPanel"
import { PublishPanel } from "./PublishPanel"
import { AdLinkBlock } from "./AdLinkBlock"
import { DesignEditor } from "./DesignEditor"
import { loadDesign } from "@/lib/server/page-design"
import { parsePeriod } from "@/lib/server/stats"
import { formatStat } from "@/lib/page-builder/stats"

export const dynamic = "force-dynamic"

const defaultTheme = (product: string): Theme => THEMES.find((t) => t.product === product) ?? THEMES[THEMES.length - 1]
const TONE = { ok: "bg-green-100 text-green-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" } as const

export default async function CreatorEditor({ params, searchParams }: { params: { id: string }; searchParams: { etape?: string; theme?: string; ok?: string; from?: string; to?: string } }) {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  const isNew = params.id === "nouvelle"
  const page = isNew ? null : await loadBuilderPage(params.id, searchParams.theme)
  if (!isNew && !page) notFound()
  const theme = themeById(searchParams.theme) ?? (page ? defaultTheme(page.category.product) : null)
  if (!theme) redirect("/admin/createur/modeles")
  const etape = isNew ? "infos" : ["infos", "design", "formulaire", "apercu", "publication", "stats"].includes(searchParams.etape ?? "") ? (searchParams.etape as string) : "infos"
  const category = page?.category ?? null
  const path = category ? creatorPath(category.slug) : ""
  const family = familyOf(category?.product ?? theme.product)

  const period = parsePeriod(searchParams.from, searchParams.to, 30)
  const catalogue = etape === "infos" ? await catalogueOffers(page?.category.id).catch(() => []) : []
  const stats = etape === "stats" && page ? await loadPageStats(page.category.slug, period).catch(() => null) : null

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/createur" className="text-sm text-violet-700 font-semibold">← Mes pages</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-black">{category ? category.name : `Nouvelle page — ${theme.label}`}</h1>
          {page && <span title={page.status.detail} className={`px-2 py-0.5 rounded-full text-xs font-bold ${TONE[page.status.tone]}`}>{page.status.label}</span>}
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{theme.emoji} {theme.label}</span>
        </div>
      </div>
      <Stepper current={etape} id={params.id} theme={theme.id} saved={!isNew} />
      {searchParams.ok && etape === "infos" && <div role="status" className="rounded-xl p-3 text-sm bg-green-50 text-green-800 border border-green-200">Brouillon créé. Complétez les informations puis passez à l&apos;étape suivante.</div>}

      {etape === "infos" && <PageEditor key={category?.id ?? "nouvelle"} theme={theme} category={category} offers={page?.offers.filter((o) => !o.archived_at) ?? []} slugLock={page?.lock.locked ? { locked: true, message: page.lock.message } : { locked: false }} catalogue={catalogue} />}

      {etape === "design" && page && (
        <DesignStep id={params.id} product={page.category.product} />
      )}

      {etape === "formulaire" && page && (
        <section className="bg-white rounded-2xl border p-5 space-y-4" aria-label="Formulaire">
          <h2 className="font-black">4. Formulaire de demande</h2>
          <p className="text-sm text-gray-700">Le formulaire de la page est le <strong>système de collecte existant</strong> d&apos;Easy2Book, adapté à la famille « {family} ».</p>
          <ul className="text-sm space-y-1.5">
            <li>✓ <strong>Visible au premier contact</strong> : nom et prénom, WhatsApp, offre choisie{family === "autre" ? "" : ", nombre de voyageurs"}, code promo facultatif.</li>
            <li>✓ <strong>Consentements</strong> : le visiteur accepte d&apos;être recontacté (case obligatoire) ; le marketing et les traceurs restent des choix séparés et facultatifs.</li>
            <li>✓ <strong>Où vont les demandes</strong> : dans le CRM de votre organisation, avec la campagne (UTM, identifiants publicitaires), le canal et la page d&apos;arrivée <code dir="ltr">{path}</code>.</li>
            <li>✓ Protection anti-spam et limitation de débit déjà en place.</li>
          </ul>
          <p className="text-xs text-gray-500">Les champs ne sont pas modifiables page par page pour l&apos;instant ; région, e-mail et message restent des champs facultatifs de qualification dans le CRM.</p>
          <Link href={`/admin/createur/${params.id}?etape=apercu&theme=${theme.id}`} className="inline-block bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl">Continuer vers l&apos;aperçu →</Link>
        </section>
      )}

      {etape === "apercu" && page && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
          <section className="bg-white rounded-2xl border p-5 space-y-3" aria-label="Aperçu">
            <h2 className="font-black">5. Aperçu de la page</h2>
            <PreviewPanel id={params.id} />
          </section>
          <section className="bg-white rounded-2xl border p-5 space-y-3" aria-label="Vérifications">
            <h2 className="font-black">Vérifications</h2>
            <ReadinessList r={page.readiness} />
            <Link href={`/admin/createur/${params.id}?etape=publication&theme=${theme.id}`} className="inline-block bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl">Continuer vers la publication →</Link>
          </section>
        </div>
      )}

      {etape === "publication" && page && (
        <div className="space-y-5">
          <PublishPanel id={params.id} theme={theme.id} visible={page.category.visible} ready={page.readiness.ready} publicUrl={`${SITE_URL}${path}`} />
          <AdLinkBlock key={`${path}-${page.category.visible}`} path={path} defaultCampaign={page.category.slug} status={page.status} base={SITE_URL} />
        </div>
      )}

      {etape === "stats" && page && (
        <section className="space-y-4" aria-label="Statistiques commerciales" data-testid="page-stats">
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <h2 className="font-black">7. Statistiques commerciales</h2>
            <form method="get" className="flex flex-wrap items-end gap-2" action={`/admin/createur/${params.id}`}>
              <input type="hidden" name="etape" value="stats" /><input type="hidden" name="theme" value={theme.id} />
              <label className="text-sm">Du <input type="date" name="from" defaultValue={period.from} className="border rounded-lg px-2 py-2 min-h-[44px]" /></label>
              <label className="text-sm">au <input type="date" name="to" defaultValue={period.to} className="border rounded-lg px-2 py-2 min-h-[44px]" /></label>
              <button className="px-4 py-2 rounded-lg border font-bold min-h-[44px]">Afficher</button>
            </form>
            <p className="text-xs text-gray-500">Prospects créés du {period.from} au {period.to}. Les chiffres viennent du CRM Easy2Book ; une donnée absente est affichée « NON DISPONIBLE », jamais remplacée par une estimation.</p>
          </div>
          {stats === null ? (
            <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">Statistiques indisponibles pour le moment.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {stats.cards.map((c) => (
                  <div key={c.id} data-testid={`stat-${c.id}`} data-available={c.value === null ? "no" : "yes"} className={`bg-white rounded-2xl border p-4 ${c.tone === "warn" ? "border-amber-300" : ""}`}>
                    <div className="text-sm text-gray-600">{c.label}</div>
                    <div className={`text-2xl font-black ${c.value === null ? "text-gray-400 text-lg" : ""}`}>{formatStat(c)}</div>
                    <p className="text-xs text-gray-500 mt-1">{c.note}</p>
                  </div>
                ))}
              </div>
              {stats.truncated && <p className="text-xs text-amber-800">Période trop large : seuls les 10 000 premiers prospects sont comptés.</p>}
            </>
          )}
        </section>
      )}
    </div>
  )
}

async function DesignStep({ id, product }: { id: string; product: Parameters<typeof loadDesign>[1] }) {
  const loaded = await loadDesign(id, product)
  return (
    <div className="space-y-3">
      <h2 className="font-black text-lg">3. Personnaliser la page</h2>
      <DesignEditor key={id} id={id} initial={loaded.design} available={loaded.available} />
    </div>
  )
}
