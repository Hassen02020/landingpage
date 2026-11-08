import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { runWithOrg } from "@/lib/server/db"
import { loadFormConfig, loadPublicOrg, publicOfferNames } from "@/lib/server/org-public"
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
  const org = await loadPublicOrg(params.slug)
  if (!org) notFound()
  if (org.slug === "easy2book") redirect("/")
  const { config, offers } = await runWithOrg(org.id, async () => ({ config: await loadFormConfig(), offers: await publicOfferNames() }))
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
