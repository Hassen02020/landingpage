import { SITE_URL, SOCIAL_LINKS } from "@/lib/config"
import { bioLinks, companyDestinations, destinationsFor, LINK_SOURCES } from "@/lib/links"
import { dbConfigured, isPlatformOrg } from "@/lib/server/db"
import { currentStaff } from "@/lib/server/auth"
import { publicCategories } from "@/lib/server/catalog"
import { CopyButton, LinkBuilder } from "./LinkBuilder"

export const dynamic = "force-dynamic"

export default async function LinksPage() {
  // Easy2Book (plateforme) : pages fixes + catalogue. Toute AUTRE entreprise : uniquement SA page de collecte /o/<identifiant> — jamais une page ni un catalogue d'une autre entreprise.
  const platform = await isPlatformOrg()
  const staff = platform ? null : await currentStaff()
  let categories: { slug: string; name: string }[] = []
  if (platform && dbConfigured()) categories = await publicCategories().catch(() => [])
  const destinations = platform ? destinationsFor(categories) : companyDestinations(staff?.organizationSlug, staff?.organizationName)
  const bios = platform ? bioLinks(SITE_URL) : []
  const profile: Record<string, string> = { Instagram: SOCIAL_LINKS.instagram, TikTok: SOCIAL_LINKS.tiktok, Facebook: SOCIAL_LINKS.facebook }
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Liens de campagne</h1>
        <p className="text-sm text-gray-600">Un lien par source : chaque demande reçue sait d&apos;où elle vient (réseau, support, campagne). Aucune publicité n&apos;est lancée ici.</p>
      </div>

      {!platform && (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="note" data-testid="company-links-note">
          Votre lien publicitaire mène à <strong>votre page de collecte</strong>{destinations[0] ? <> (<code dir="ltr">{destinations[0].path}</code>)</> : null}. Les pages et le catalogue d&apos;Easy2Book ne vous sont pas proposés : ils conduiraient vos visiteurs vers le site d&apos;une autre entreprise.
        </p>
      )}

      <section className={card}>
        <h2 className="font-black">Créer un lien</h2>
        <LinkBuilder destinations={destinations} base={SITE_URL} />
      </section>

      {platform && (      <section className={card}>
        <h2 className="font-black">Liens de bio des comptes officiels</h2>
        <p className="text-sm text-gray-600">À coller dans la bio de chaque profil. Le lien de la bio Instagram / TikTok est la seule façon de reconnaître ces visiteurs : ces applications ne transmettent pas toujours leur origine.</p>
        <ul className="divide-y text-sm">
          {bios.map((b) => (
            <li key={b.network} className="flex flex-wrap items-center gap-2 py-2">
              <div className="w-24 shrink-0 font-bold">{b.network}</div>
              <a href={profile[b.network]} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 underline">profil ↗</a>
              <code className="min-w-0 flex-1 break-all text-xs select-all" dir="ltr">{b.url}</code>
              <CopyButton text={b.url} />
            </li>
          ))}
        </ul>
      </section>)}

      <section className={card}>
        <h2 className="font-black">Règles de nommage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500"><tr><th className="py-2 pr-4">Réseau</th><th className="pr-4">Support</th><th>Ce qui est enregistré</th></tr></thead>
            <tbody>
              {LINK_SOURCES.flatMap((s) => s.mediums.map((m) => (
                <tr key={`${s.id}-${m.id}`} className="border-t">
                  <td className="py-1.5 pr-4 font-semibold">{s.label}</td>
                  <td className="pr-4">{m.label}</td>
                  <td className="font-mono text-xs" dir="ltr">utm_source={s.utm_source} · utm_medium={m.utm_medium}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>Noms en minuscules, sans accent ni espace (<code>omra-ramadan-2027</code>) : « Omra » et « omra » sont comptés ensemble.</li>
          {platform && <li>Une seule adresse par contenu : la catégorie <code>omra-2027</code> est servie par <code>/omra</code>.</li>}
          <li>Facebook et Instagram sont tous deux comptés dans le canal « meta » ; la colonne « Source » des statistiques les distingue.</li>
          <li>Le consentement aux traceurs reste demandé : sans accord, aucune donnée n&apos;est transmise à Meta ni à TikTok.</li>
        </ul>
      </section>
    </div>
  )
}
