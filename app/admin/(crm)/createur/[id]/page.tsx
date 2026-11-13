import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { builderAccess, loadBuilderPage } from "@/lib/server/page-builder"
import { THEMES, themeById, familyOf, type Theme } from "@/lib/page-builder/themes"
import { SITE_URL } from "@/lib/config"
import { creatorPath } from "@/lib/page-builder/paths"
import { PageEditor } from "./PageEditor"
import { Stepper } from "./Stepper"
import { ReadinessList } from "./ReadinessList"
import { PreviewPanel } from "./PreviewPanel"
import { PublishPanel } from "./PublishPanel"
import { AdLinkBlock } from "./AdLinkBlock"

export const dynamic = "force-dynamic"

const defaultTheme = (product: string): Theme => THEMES.find((t) => t.product === product) ?? THEMES[THEMES.length - 1]
const TONE = { ok: "bg-green-100 text-green-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" } as const

export default async function CreatorEditor({ params, searchParams }: { params: { id: string }; searchParams: { etape?: string; theme?: string; ok?: string } }) {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  const isNew = params.id === "nouvelle"
  const page = isNew ? null : await loadBuilderPage(params.id, searchParams.theme)
  if (!isNew && !page) notFound()
  const theme = themeById(searchParams.theme) ?? (page ? defaultTheme(page.category.product) : null)
  if (!theme) redirect("/admin/createur/modeles")
  const etape = isNew ? "infos" : ["infos", "formulaire", "apercu", "publication"].includes(searchParams.etape ?? "") ? (searchParams.etape as string) : "infos"
  const category = page?.category ?? null
  const path = category ? creatorPath(category.slug) : ""
  const family = familyOf(category?.product ?? theme.product)

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

      {etape === "infos" && <PageEditor key={category?.id ?? "nouvelle"} theme={theme} category={category} offers={page?.offers.filter((o) => !o.archived_at) ?? []} slugLock={page?.lock.locked ? { locked: true, message: page.lock.message } : { locked: false }} />}

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
    </div>
  )
}
