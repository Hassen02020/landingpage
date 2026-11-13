import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { runWithOrg } from "@/lib/server/db"
import { loadFormConfig, loadPublicOrg, lookupPublicOrg, publicOfferNames } from "@/lib/server/org-public"
import { dbConfigured } from "@/lib/server/db"
import { unavailable } from "@/lib/server/public-errors"
import { OrgLeadForm } from "./OrgLeadForm"

// Rendu à chaque requête : une page d'entreprise ne doit jamais être servie depuis le cache d'une autre.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const org = await loadPublicOrg(params.slug)
  // aucune image, aucun nom de site ni identifiant de page d'Easy2Book hérités du gabarit racine
  return org
    ? { title: org.name, description: org.name, openGraph: { title: org.name, siteName: org.name, images: [], url: undefined }, other: { "fb:page_id": "" } }
    : { title: "Page introuvable" }
}

export default async function OrgPage({ params }: { params: { slug: string } }) {
  // panne ou base non configurée = erreur de SERVICE (HTTP 500, message app/error.tsx) : jamais un 404, jamais une redirection
  if (!dbConfigured()) throw unavailable("/o/[slug]", "db_not_configured", params.slug)
  const found = await lookupPublicOrg(params.slug)
  if (found.status === "error") throw unavailable("/o/[slug]", "db_error", params.slug)
  // entreprise inconnue OU suspendue : la MÊME réponse neutre (404 standard, sans redirection ni indication sur l'entreprise) — décision du propriétaire
  if (found.status === "not_found") notFound()
  const org = found.org
  if (org.slug === "easy2book") redirect("/")
  let data: { config: Awaited<ReturnType<typeof loadFormConfig>>; offers: Awaited<ReturnType<typeof publicOfferNames>> }
  try {
    data = await runWithOrg(org.id, async () => ({ config: await loadFormConfig(), offers: await publicOfferNames() }))
  } catch {
    throw unavailable("/o/[slug]", "db_error", params.slug) // panne après avoir trouvé l'entreprise : HTTP 500, journalisée
  }
  const { config, offers } = data
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center text-white">
          <h1 className="text-3xl font-black">{config.title || org.name}</h1>
          {config.intro && <p className="mt-2 text-violet-200">{config.intro}</p>}
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          <OrgLeadForm slug={org.slug} config={config} offers={offers} />
        </div>
        <p className="mt-4 text-center text-xs text-violet-300">{org.name}</p>
      </div>
    </main>
  )
}
