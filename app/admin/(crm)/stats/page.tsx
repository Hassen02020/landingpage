import { PRODUCTS, type Product } from "@/lib/config"
import { select } from "@/lib/server/db"

export const dynamic = "force-dynamic"

type Campaign = { channel: string; utm_campaign: string; product: Product; leads: number; leads_traites: number; reservations: number; taux_conversion_pct: number | null; chiffre_affaires_tnd: number }
type Niche = { product: Product | null; niche: string; clics_whatsapp: number; visiteurs_contact: number; leads: number; reservations: number; chiffre_affaires_tnd: number }

export default async function StatsPage() {
  const [campaigns, niches] = await Promise.all([
    select<Campaign>("landing_campaign_performance", "select=*&order=leads.desc&limit=200").catch(() => null),
    select<Niche>("landing_niche_performance", "select=*&order=leads.desc&limit=200").catch(() => null),
  ])
  const th = "p-3 text-left text-gray-500"
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Statistiques</h1>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <h2 className="font-bold p-3">Par campagne</h2>
        {!campaigns ? <p className="p-3 text-red-700">Lecture impossible.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b"><tr><th className={th}>Canal</th><th className={th}>Campagne</th><th className={th}>Produit</th><th className={th}>Leads</th><th className={th}>Traités</th><th className={th}>Réservations</th><th className={th}>Conversion</th><th className={th}>CA (TND)</th></tr></thead>
            <tbody>{campaigns.map((c, i) => (
              <tr key={i} className="border-b last:border-0"><td className="p-3">{c.channel}</td><td className="p-3">{c.utm_campaign}</td><td className="p-3">{PRODUCTS[c.product]}</td><td className="p-3">{c.leads}</td><td className="p-3">{c.leads_traites}</td><td className="p-3">{c.reservations}</td><td className="p-3">{c.taux_conversion_pct ?? 0} %</td><td className="p-3">{c.chiffre_affaires_tnd}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <h2 className="font-bold p-3">Par niche</h2>
        {!niches ? <p className="p-3 text-red-700">Lecture impossible.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b"><tr><th className={th}>Produit</th><th className={th}>Niche</th><th className={th}>Clics WhatsApp</th><th className={th}>Visiteurs</th><th className={th}>Leads</th><th className={th}>Réservations</th><th className={th}>CA (TND)</th></tr></thead>
            <tbody>{niches.map((n, i) => (
              <tr key={i} className="border-b last:border-0"><td className="p-3">{n.product ? PRODUCTS[n.product] : "—"}</td><td className="p-3">{n.niche}</td><td className="p-3">{n.clics_whatsapp}</td><td className="p-3">{n.visiteurs_contact}</td><td className="p-3">{n.leads}</td><td className="p-3">{n.reservations}</td><td className="p-3">{n.chiffre_affaires_tnd}</td></tr>
            ))}</tbody>
          </table>
        )}
        <p className="p-3 text-xs text-gray-500">Les clics ne sont comptés que pour les visiteurs ayant accepté les traceurs.</p>
      </section>
    </div>
  )
}
