import Link from "next/link"
import { PRODUCTS, type Product } from "@/lib/config"
import { select } from "@/lib/server/db"
import { loadWhatsApp } from "@/lib/server/whatsapp-stats"
import { groupBy, groupByOffer, loadLeadStats, loadTeam, parsePeriod, rates, teamStats, totals, type Counts, type Level, type Period } from "@/lib/server/stats"

export const dynamic = "force-dynamic"

type Niche = { product: Product | null; niche: string; clics_whatsapp: number; visiteurs_contact: number; leads: number; reservations: number; chiffre_affaires_tnd: number }

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`
const pct = (r: number) => `${Math.round(r * 100)} %`

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`inline-block w-2.5 h-2.5 rounded-full mb-2 ${tone}`} />
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      {sub && <div className="mt-2 text-xs bg-gray-50 rounded-lg px-2 py-1 text-gray-600">{sub}</div>}
    </div>
  )
}

function Tabs({ view, p }: { view: string; p: Period }) {
  const q = `from=${p.from}&to=${p.to}`
  const cls = (v: string) => `px-4 py-2 rounded-xl text-sm font-bold ${view === v ? "bg-violet-700 text-white" : "bg-white border hover:bg-gray-50"}`
  return (
    <div className="flex gap-2">
      <Link href={`/admin/stats?view=marketing&${q}`} className={cls("marketing")}>Marketing</Link>
      <Link href={`/admin/stats?view=equipe&${q}`} className={cls("equipe")}>Équipe | Suivi</Link>
      <Link href={`/admin/stats?view=whatsapp&${q}`} className={cls("whatsapp")}>WhatsApp</Link>
      <Link href={`/admin/stats?view=offres&${q}`} className={cls("offres")}>Offres</Link>
      <Link href={`/admin/stats?view=niches&${q}`} className={cls("niches")}>Niches</Link>
    </div>
  )
}

function PeriodForm({ view, p, extra }: { view: string; p: Period; extra?: React.ReactNode }) {
  const preset = (days: number) => {
    const pp = parsePeriod(undefined, undefined, days)
    return `/admin/stats?view=${view}&from=${pp.from}&to=${pp.to}`
  }
  return (
    <form className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="view" value={view} />
      {extra}
      <label className="flex flex-col">Du<input type="date" name="from" defaultValue={p.from} className="border rounded-lg px-2 py-1.5" /></label>
      <label className="flex flex-col">Au<input type="date" name="to" defaultValue={p.to} className="border rounded-lg px-2 py-1.5" /></label>
      <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-lg">Afficher</button>
      <div className="flex gap-2 text-xs">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={preset(d)} className="border rounded-lg px-2 py-1.5 hover:bg-gray-50">{d} j</Link>
        ))}
      </div>
    </form>
  )
}

function KpiGrid({ c }: { c: Counts }) {
  const r = rates(c)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi label="Leads reçus" value={c.leads} tone="bg-violet-600" sub={`Traités : ${pct(r.treatmentRate)}`} />
      <Kpi label="À traiter" value={c.toTreat} tone="bg-blue-500" sub="nouveau + à contacter" />
      <Kpi label="En contact" value={c.inContact} tone="bg-sky-500" sub="contacté + à qualifier" />
      <Kpi label="Qualifiés" value={c.qualified} tone="bg-amber-500" />
      <Kpi label="Devis / négociation" value={c.proposal} tone="bg-indigo-500" />
      <Kpi label="Vendus" value={c.booked} tone="bg-green-600" sub={`réservé + gagné · CA : ${tnd(c.revenue)}`} />
      <Kpi label="Perdus" value={c.lost} tone="bg-red-500" sub={`Conclusion : ${pct(r.closingRate)}`} />
    </div>
  )
}

const th = "p-3 text-left text-gray-500 font-semibold whitespace-nowrap"
const td = "p-3 whitespace-nowrap"

async function Marketing({ p, level }: { p: Period; level: Level }) {
  const rows = await loadLeadStats(p).catch(() => null)
  if (!rows) return <p className="text-red-700">Lecture impossible.</p>
  const c = totals(rows)
  const groups = groupBy(rows, level)
  const r = rates(c)
  return (
    <div className="space-y-4">
      <KpiGrid c={c} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-white rounded-2xl border p-4">Taux de réservation <strong className="block text-xl">{pct(r.bookingRate)}</strong><span className="text-xs text-gray-500">réservations / leads reçus</span></div>
        <div className="bg-white rounded-2xl border p-4">Panier moyen <strong className="block text-xl">{tnd(r.avgBasket)}</strong><span className="text-xs text-gray-500">par réservation</span></div>
        <div className="bg-white rounded-2xl border p-4">Chiffre d&apos;affaires <strong className="block text-xl">{tnd(c.revenue)}</strong><span className="text-xs text-gray-500">montants saisis à la réservation</span></div>
      </div>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className={th}>Canal</th>
              <th className={th}>Source</th>
              <th className={th}>Campagne</th>
              {level !== "campaign" && <th className={th}>Groupe d&apos;annonces</th>}
              {level === "ad" && <th className={th}>Annonce</th>}
              <th className={th}>Leads</th>
              <th className={th}>Traités</th>
              <th className={th}>Vendus</th>
              <th className={th}>Taux de vente</th>
              <th className={th}>CA</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-gray-500">Aucun lead sur la période.</td></tr>
            )}
            {groups.map((g) => {
              const gr = rates(g)
              return (
                <tr key={g.key} className="border-b last:border-0">
                  <td className={td}>{g.channel}</td>
                  <td className={td}>{g.source}</td>
                  <td className={td}>{g.campaign}</td>
                  {level !== "campaign" && <td className={td}>{g.adset}</td>}
                  {level === "ad" && <td className={td}>{g.ad}</td>}
                  <td className={td}>{g.leads}</td>
                  <td className={td}>{gr.treated}</td>
                  <td className={td}>{g.booked}</td>
                  <td className={td}>{pct(gr.bookingRate)}</td>
                  <td className={td}>{tnd(g.revenue)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-gray-500">
        Campagne = utm_campaign, groupe d&apos;annonces = utm_term, annonce = utm_content (paramètres à coller dans les publicités : voir Intégrations).
      </p>
    </div>
  )
}

async function Team({ p, member }: { p: Period; member: string }) {
  const data = await loadTeam(p).catch(() => null)
  if (!data) return <p className="text-red-700">Lecture impossible.</p>
  const all = teamStats(data.staff, data.activities, data.leads)
  const list = member ? all.filter((m) => m.userId === member) : all
  const sum = list.reduce(
    (a, m) => ({ actions: a.actions + m.actions, contacted: a.contacted + m.contacted, qualified: a.qualified + m.qualified, proposals: a.proposals + m.proposals, booked: a.booked + m.booked, lost: a.lost + m.lost, notes: a.notes + m.notes, assigned: a.assigned + m.assigned }),
    { actions: 0, contacted: 0, qualified: 0, proposals: 0, booked: 0, lost: 0, notes: 0, assigned: 0 }
  )
  const closing = sum.booked + sum.lost ? sum.booked / (sum.booked + sum.lost) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Leads assignés" value={sum.assigned} tone="bg-violet-600" />
        <Kpi label="Actions (statuts, notes…)" value={sum.actions} tone="bg-blue-500" sub={`dont notes : ${sum.notes}`} />
        <Kpi label="Contactés" value={sum.contacted} tone="bg-sky-500" />
        <Kpi label="Qualifiés" value={sum.qualified} tone="bg-amber-500" />
        <Kpi label="Devis envoyés" value={sum.proposals} tone="bg-indigo-500" />
        <Kpi label="Ventes" value={sum.booked} tone="bg-green-600" sub="réservé / gagné, comptée une fois" />
        <Kpi label="Perdus" value={sum.lost} tone="bg-red-500" />
        <Kpi label="Taux de conclusion" value={pct(closing)} tone="bg-emerald-600" sub="réservés / (réservés + perdus)" />
      </div>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {["Membre", "Rôle", "Assignés", "Actions", "Contactés", "Qualifiés", "Devis", "Ventes", "Perdus", "Conclusion"].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.userId} className={`border-b last:border-0 ${m.active ? "" : "text-gray-400"}`}>
                <td className={td}>{m.name}{!m.active && " (inactif)"}</td>
                <td className={td}>{m.role}</td>
                <td className={td}>{m.assigned}</td>
                <td className={td}>{m.actions}</td>
                <td className={td}>{m.contacted}</td>
                <td className={td}>{m.qualified}</td>
                <td className={td}>{m.proposals}</td>
                <td className={td}>{m.booked}</td>
                <td className={td}>{m.lost}</td>
                <td className={td}>{pct(m.closingRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-gray-500">Calcul à partir de l&apos;historique des leads (changements de statut faits par chaque membre sur la période).</p>
    </div>
  )
}

async function WhatsAppView({ p }: { p: Period }) {
  const f = await loadWhatsApp(p).catch(() => null)
  if (!f) return <p className="text-red-700">Lecture impossible.</p>
  const rows: { step: string; value: string | number; nature: "Observé" | "Saisi par l'équipe" | "Calculé"; source: string }[] = [
    { step: "Clics WhatsApp", value: f.clicks, nature: "Observé", source: "Navigateur du visiteur (événement « Contact »), uniquement s'il a accepté les traceurs. Un clic n'est pas un message envoyé." },
    { step: "Visiteurs distincts ayant cliqué", value: f.visitorsClicked, nature: "Observé", source: "Références E2B distinctes des clics." },
    { step: "Demandes par formulaire", value: f.formLeads, nature: "Observé", source: "Leads créés par le formulaire du site." },
    { step: "Leads créés depuis un message reçu", value: f.whatsappLeads, nature: "Saisi par l'équipe", source: "« Nouveau lead » avec la source WhatsApp." },
    { step: "Leads rattachés à un clic", value: f.attachedLeads, nature: "Calculé", source: "Leads dont la référence E2B correspond à un clic enregistré." },
    { step: "Messages reçus enregistrés", value: f.messagesIn, nature: "Saisi par l'équipe", source: "Bouton « Message reçu » de la fiche lead." },
    { step: "Messages envoyés enregistrés", value: f.messagesOut, nature: "Saisi par l'équipe", source: "Bouton « Message envoyé » de la fiche lead." },
    { step: "Conversations suivies", value: f.conversations, nature: "Calculé", source: "Leads avec au moins un échange enregistré." },
    { step: "Réservations issues de WhatsApp", value: f.reserved, nature: "Calculé", source: "Leads réservés ayant la source WhatsApp, un clic rattaché ou un échange enregistré." },
  ]
  const tone: Record<string, string> = { "Observé": "bg-blue-100 text-blue-800", "Saisi par l'équipe": "bg-amber-100 text-amber-800", "Calculé": "bg-gray-200 text-gray-700" }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Clics WhatsApp" value={f.clicks} tone="bg-blue-500" sub={`${f.visitorsClicked} visiteur(s)`} />
        <Kpi label="Conversations suivies" value={f.conversations} tone="bg-amber-500" sub={`${f.messagesIn} reçus · ${f.messagesOut} envoyés`} />
        <Kpi label="Rattachement des messages" value={pct(f.whatsappAttachedRate)} tone="bg-violet-600" sub="leads WhatsApp dont le clic est retrouvé" />
        <Kpi label="Réservations" value={f.reserved} tone="bg-green-600" sub={`CA : ${tnd(f.revenue)}`} />
      </div>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50"><tr>{["Étape", "Valeur", "Nature", "Définition et source"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.step} className="border-b last:border-0">
                <td className={`${td} font-semibold`}>{r.step}</td>
                <td className={td}>{r.value}</td>
                <td className={td}><span className={`text-xs font-bold px-2 py-1 rounded-full ${tone[r.nature]}`}>{r.nature}</span></td>
                <td className="p-3 text-gray-600">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
        <strong>Non observable sans l&apos;API officielle WhatsApp Business :</strong> l&apos;ouverture de l&apos;application, l&apos;envoi réel du message par le visiteur, la lecture et la réponse. Ces étapes ne sont jamais déduites d&apos;un clic.
      </div>
    </div>
  )
}

async function Offers({ p }: { p: Period }) {
  const rows = await loadLeadStats(p).catch(() => null)
  if (!rows) return <p className="text-red-700">Lecture impossible.</p>
  const groups = groupByOffer(rows)
  return (
    <div className="space-y-4">
      <KpiGrid c={totals(rows)} />
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50"><tr>{["Produit", "Offre", "Leads", "À traiter", "En contact", "Qualifiés", "Devis / négo.", "Vendus", "Perdus", "Taux de vente", "CA"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-gray-500">Aucun lead sur la période.</td></tr>}
            {groups.map((g) => (
              <tr key={g.key} className="border-b last:border-0">
                <td className={td}>{PRODUCTS[g.product as Product] ?? g.product}</td>
                <td className={td}>{g.offer}</td>
                <td className={td}>{g.leads}</td>
                <td className={td}>{g.toTreat}</td>
                <td className={td}>{g.inContact}</td>
                <td className={td}>{g.qualified}</td>
                <td className={td}>{g.proposal}</td>
                <td className={td}>{g.booked}</td>
                <td className={td}>{g.lost}</td>
                <td className={td}>{pct(rates(g).bookingRate)}</td>
                <td className={td}>{tnd(g.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

async function Niches() {
  const niches = await select<Niche>("landing_niche_performance", "select=*&order=leads.desc&limit=200").catch(() => null)
  if (!niches) return <p className="text-red-700">Lecture impossible.</p>
  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50"><tr>{["Produit", "Niche", "Clics WhatsApp", "Visiteurs", "Leads", "Réservations", "CA"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{niches.map((n, i) => (
          <tr key={i} className="border-b last:border-0"><td className={td}>{n.product ? PRODUCTS[n.product] : "—"}</td><td className={td}>{n.niche}</td><td className={td}>{n.clics_whatsapp}</td><td className={td}>{n.visiteurs_contact}</td><td className={td}>{n.leads}</td><td className={td}>{n.reservations}</td><td className={td}>{tnd(Number(n.chiffre_affaires_tnd))}</td></tr>
        ))}</tbody>
      </table>
      <p className="p-3 text-xs text-gray-500">Toutes périodes. Les clics ne sont comptés que pour les visiteurs ayant accepté les traceurs.</p>
    </section>
  )
}

export default async function StatsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const view = ["marketing", "equipe", "whatsapp", "offres", "niches"].includes(searchParams.view || "") ? searchParams.view! : "marketing"
  const p = parsePeriod(searchParams.from, searchParams.to)
  const level: Level = (["campaign", "adset", "ad"] as const).find((l) => l === searchParams.level) ?? "campaign"
  const member = /^[0-9a-f-]{36}$/i.test(searchParams.member || "") ? searchParams.member! : ""

  let staffOptions: { user_id: string; email: string; full_name: string | null }[] = []
  if (view === "equipe") staffOptions = await select<{ user_id: string; email: string; full_name: string | null }>("landing_staff", "select=user_id,email,full_name&order=email.asc").catch(() => [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Statistiques</h1>
        <Tabs view={view} p={p} />
      </div>

      {view !== "niches" && (
        <PeriodForm
          view={view}
          p={p}
          extra={
            view === "offres" || view === "whatsapp" ? null : view === "marketing" ? (
              <label className="flex flex-col">Détail
                <select name="level" defaultValue={level} className="border rounded-lg px-2 py-1.5">
                  <option value="campaign">Par campagne</option>
                  <option value="adset">Par groupe d&apos;annonces</option>
                  <option value="ad">Par annonce</option>
                </select>
              </label>
            ) : (
              <label className="flex flex-col">Membre
                <select name="member" defaultValue={member} className="border rounded-lg px-2 py-1.5">
                  <option value="">Tous les membres de l&apos;équipe</option>
                  {staffOptions.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
                </select>
              </label>
            )
          }
        />
      )}
      {view !== "niches" && (
        <p className="text-xs text-gray-500">Leads reçus entre le {p.from.split("-").reverse().join("/")} et le {p.to.split("-").reverse().join("/")}.</p>
      )}

      {view === "marketing" && <Marketing p={p} level={level} />}
      {view === "equipe" && <Team p={p} member={member} />}
      {view === "whatsapp" && <WhatsAppView p={p} />}
      {view === "offres" && <Offers p={p} />}
      {view === "niches" && <Niches />}
    </div>
  )
}
