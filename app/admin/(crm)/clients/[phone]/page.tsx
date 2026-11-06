import Link from "next/link"
import { notFound } from "next/navigation"
import { loadCustomer } from "@/lib/server/customer"
import { STATUS_LABELS } from "@/lib/status"
import { TIER_COLORS, TIER_LABELS, vipThreshold } from "@/lib/loyalty"
import { SOURCE_LABELS, type Source } from "@/lib/server/crm"
import { STATUS_COLORS, formatDate } from "../../../format"

export const dynamic = "force-dynamic"

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`
const LABELS: Record<string, string> = {
  created: "Création", status_change: "Statut", note: "Note", assignment: "Assignation", follow_up: "Relance",
  marketing_withdrawn: "Consentement", anonymized: "Anonymisation", wa_in: "💬 WhatsApp reçu", wa_out: "💬 WhatsApp envoyé",
}

export default async function ClientPage({ params }: { params: { phone: string } }) {
  const c = await loadCustomer(params.phone).catch(() => null)
  if (!c) notFound()
  const s = c.summary
  const stat = (label: string, value: React.ReactNode) => (
    <div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-xl font-black">{value}</div><div className="text-sm text-gray-500">{label}</div></div>
  )
  return (
    <div className="space-y-4">
      <Link href="/admin/clients" className="text-sm underline">← Clients</Link>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-black">{c.name}</h1>
        <span className="font-mono text-gray-500">+{c.phone}</span>
        {s.tier && <span data-testid="tier" className={`px-3 py-1 rounded-full text-sm font-bold ${TIER_COLORS[s.tier]}`}>{TIER_LABELS[s.tier]}</span>}
        {c.email && <span className="text-gray-500">{c.email}</span>}
        {c.region && <span className="text-gray-500">· {c.region}</span>}
        <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" className="ml-auto bg-green-500 text-white font-bold px-4 py-2 rounded-xl">💬 WhatsApp</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="client-stats">
        {stat("Demandes", s.leads)}
        {stat("En cours", s.openLeads)}
        {stat("Ventes (réservé + gagné)", s.booked)}
        {stat("Chiffre d'affaires", s.revenue ? tnd(s.revenue) : "—")}
        {stat("WhatsApp reçus / envoyés", `${c.whatsapp.received} / ${c.whatsapp.sent}`)}
      </div>
      <section className="bg-white rounded-2xl shadow-sm p-4 text-sm" data-testid="loyalty">
        <h2 className="font-bold mb-2">Fidélité</h2>
        <p>Chiffre d'affaires cumulé à vie : <b>{tnd(s.revenue)}</b> sur {s.booked} vente(s). Niveau : <b>{s.tier ? TIER_LABELS[s.tier] : "aucun (pas encore de vente)"}</b>. {vipThreshold() === null ? "Seuil VIP non défini : personne n'est classé VIP pour l'instant." : `Seuil VIP : ${tnd(vipThreshold()!)}.`} Aucun avantage automatique (étiquette et segment seulement).</p>
      </section>
      <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
        <h2 className="font-bold mb-2">Consentements</h2>
        <p>Contact : accord (obligatoire pour enregistrer une demande). Marketing : <b>{c.consents.marketing ? "accord" : "non"}</b>{c.consents.marketingWithdrawnAt ? ` — retiré le ${formatDate(c.consents.marketingWithdrawnAt)}` : ""}. Suivi publicitaire : {c.consents.tracking ? "accepté sur au moins une demande" : "non"}. Un seul refus ou retrait sur une demande suffit à exclure le client du marketing.</p>
      </section>
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <h2 className="font-bold p-4 pb-0">Demandes</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b"><tr><th className="p-3">Réf.</th><th className="p-3">Produit / offre</th><th className="p-3">Statut</th><th className="p-3">Montant</th><th className="p-3">Canal</th><th className="p-3">Origine</th><th className="p-3">Date</th></tr></thead>
          <tbody>
            {c.leads.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3"><Link className="font-mono underline" href={`/admin/leads/${l.id}`}>{l.ref}</Link></td>
                <td className="p-3">{l.product}{l.offer ? ` — ${l.offer}` : ""}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span></td>
                <td className="p-3">{l.booking_value ? tnd(Number(l.booking_value)) : "—"}</td>
                <td className="p-3">{l.channel || "direct"}{l.utm_campaign ? ` · ${l.utm_campaign}` : ""}</td>
                <td className="p-3">{SOURCE_LABELS[(l.source ?? "form") as Source]}</td>
                <td className="p-3">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
        <h2 className="font-bold mb-2">Chronologie commune</h2>
        <ul className="space-y-2" data-testid="client-timeline">
          {c.timeline.map((t) => (
            <li key={`${t.lead_id}-${t.id}`} className="border-b last:border-0 pb-2">
              <span className="text-gray-500">{formatDate(t.created_at)}</span> · <b>{LABELS[t.type] ?? t.type}</b> · <span className="font-mono text-xs">{t.lead_ref}</span> · {t.actor_label}
              {t.type === "status_change" && t.to_status ? <> : {t.from_status ? STATUS_LABELS[t.from_status] : "—"} → {STATUS_LABELS[t.to_status]}</> : null}
              {t.body ? <div className="text-gray-700 whitespace-pre-wrap">{t.body}</div> : null}
            </li>
          ))}
          {!c.timeline.length && <li className="text-gray-500">Aucune activité.</li>}
        </ul>
      </section>
    </div>
  )
}
