import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { integrationViews } from "@/lib/server/integrations"
import { SITE_URL } from "@/lib/config"
import { IntegrationCard } from "./IntegrationCard"
import { MetaLeadsCard } from "./MetaLeadsCard"
import { listMetaPages } from "@/lib/server/meta-pages"

export const dynamic = "force-dynamic"

// Paramètres à coller dans les publicités pour que chaque lead soit rattaché à sa campagne,
// son groupe d'annonces et son annonce (statistiques marketing).
const URL_PARAMS = {
  meta: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}",
  tiktok: "utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_term=__AID_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__",
}

export default async function IntegrationsPage() {
  const staff = await currentStaff()
  if (!can(staff?.orgRole, "social.connect")) {
    return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux administrateurs.</p>
  }
  const views = await integrationViews()
  const metaPages = staff?.organizationId ? await listMetaPages(staff.organizationId) : { pages: [], migrationApplied: true }
  const webhookReady = Boolean(process.env.META_APP_SECRET && process.env.META_LEADS_VERIFY_TOKEN)
  const migrationApplied = views.every((v) => v.migrationApplied)
  const host = new URL(SITE_URL).host

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Intégrations</h1>
        <p className="text-gray-600 text-sm">Pixels et API de conversions, réglables sans passer par Vercel. Les jetons sont chiffrés avant d'être enregistrés.</p>
      </div>

      {!migrationApplied && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          La migration <code>0003_landing_admin.sql</code> n&apos;est pas encore appliquée dans Supabase : l&apos;écran est en lecture seule et le site utilise les variables Vercel.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {views.map((v) => (
          <IntegrationCard key={v.provider} view={v} />
        ))}
        <MetaLeadsCard pages={metaPages.pages} webhookUrl={`${SITE_URL}/api/webhooks/meta-leads`} webhookReady={webhookReady} migrationApplied={metaPages.migrationApplied} />
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-black">Paramètres d&apos;URL des publicités</h2>
        <p className="text-sm text-gray-600">
          À coller dans « Paramètres d&apos;URL » de chaque publicité. Sans eux, les statistiques marketing ne peuvent pas séparer campagne, groupe d&apos;annonces et annonce.
        </p>
        {(["meta", "tiktok"] as const).map((p) => (
          <div key={p}>
            <div className="text-xs font-bold text-gray-500 mb-1">{p === "meta" ? "Meta" : "TikTok"}</div>
            <code className="block bg-gray-50 border rounded-xl p-3 text-xs break-all select-all" dir="ltr">
              {URL_PARAMS[p]}
            </code>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2 text-sm">
        <h2 className="font-black">Domaine</h2>
        <p>
          Adresse actuelle : <strong dir="ltr">{host}</strong>
        </p>
        <p className="text-gray-600">Pour utiliser votre propre domaine (ex. omra.easy2book.tn) :</p>
        <ol className="list-decimal pr-5 pl-5 text-gray-600 space-y-1">
          <li>Vercel &gt; projet landingpage &gt; Settings &gt; Domains &gt; Add, puis saisir le domaine.</li>
          <li>Chez votre fournisseur de domaine, créer l&apos;enregistrement DNS indiqué par Vercel (CNAME vers cname.vercel-dns.com pour un sous-domaine).</li>
          <li>Mettre à jour NEXT_PUBLIC_SITE_URL, puis vérifier le domaine dans Meta Business (Paramètres &gt; Domaines).</li>
        </ol>
        <p className="text-xs text-gray-500">Le domaine se règle dans Vercel et chez le registraire : cet écran ne peut pas le modifier.</p>
      </section>
    </div>
  )
}
