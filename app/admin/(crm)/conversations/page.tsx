import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listConversations } from "@/lib/server/conversations"
import { CHANNELS, CHANNEL_LABELS, CONV_STATUS_LABELS, ORIGINS, ORIGIN_LABELS, STAGE_LABELS, rate, type ConvStatus, type Stage } from "@/lib/conversations"
import { addConversationAction, addLotAction, cancelConversationAction } from "../../conversations-actions"

export const dynamic = "force-dynamic"

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short" })
const input = "border rounded-lg px-3 py-2 text-sm bg-white w-full min-w-0"
const btn = "px-4 py-2 rounded-lg text-sm font-bold bg-brand-600 text-white"

export default async function ConversationsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "leads.view_all")) return <p className="bg-white rounded-2xl p-6">Accès réservé à l&apos;équipe.</p>
  const days = [7, 30, 90].includes(Number(searchParams.jours)) ? Number(searchParams.jours) : 30
  const { rows, stats, tableMissing } = await listConversations({ days })
  const today = new Date().toISOString().slice(0, 10)
  const toProspect = rate(stats.prospects, stats.conversations)
  const toSale = rate(stats.ventes, stats.prospects)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Conversations</h1>
        <p className="text-sm text-gray-600">
          Une conversation n&apos;est pas un prospect, et un prospect n&apos;est pas une vente. Le numéro de téléphone reste dans la fiche du client : il n&apos;apparaît jamais ici.
        </p>
      </div>
      {tableMissing && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">La migration <code>0029_conversations.sql</code> n&apos;est pas encore appliquée dans Supabase : la saisie est désactivée.</div>}
      {searchParams.ok && <div role="status" className="bg-green-50 border border-green-200 text-green-900 rounded-2xl p-3 text-sm">{searchParams.ok}</div>}
      {searchParams.erreur && <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-3 text-sm">{searchParams.erreur}</div>}

      <section aria-label="Indicateurs" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Conversations", String(stats.conversations), `${days} derniers jours`],
          ["Prospects (fiche reliée)", String(stats.prospects), toProspect === null ? "taux : échantillon trop petit" : `${toProspect} % des conversations`],
          ["Qualifiés", String(stats.qualifies), "fiche qualifiée ou au-delà"],
          ["Ventes", String(stats.ventes), toSale === null ? "taux : échantillon trop petit" : `${toSale} % des prospects`],
        ].map(([label, value, hint]) => (
          <div key={label} className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-black" data-testid="conv-stat">{value}</div>
            <div className="text-xs text-gray-600">{hint}</div>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <form action={addLotAction} className="bg-white rounded-2xl border p-4 space-y-3" aria-labelledby="lot-title">
          <h2 id="lot-title" className="font-black">Saisie du jour (sans identité)</h2>
          <p className="text-xs text-gray-500">« n conversations aujourd&apos;hui sur ce canal ». Ne crée aucun prospect ni aucune vente.</p>
          <label className="block text-sm">Canal<select name="channel" required className={input}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}</select></label>
          <label className="block text-sm">Origine<select name="origin" className={input} defaultValue="annonce">{ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABELS[o]}</option>)}</select></label>
          <label className="block text-sm">Campagne (facultatif)<input name="campaign" maxLength={255} className={input} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Nombre<input name="count" type="number" min={1} max={1000} required className={input} /></label>
            <label className="block text-sm">Jour<input name="day" type="date" defaultValue={today} max={today} className={input} /></label>
          </div>
          <button className={btn} disabled={tableMissing}>Enregistrer le lot</button>
        </form>

        <form action={addConversationAction} className="bg-white rounded-2xl border p-4 space-y-3" aria-labelledby="indiv-title">
          <h2 id="indiv-title" className="font-black">Nouvelle conversation</h2>
          <p className="text-xs text-gray-500">Reliez-la à un dossier existant par sa référence (E2B-XXXXXX) ; le numéro reste dans le dossier.</p>
          <label className="block text-sm">Canal<select name="channel" required className={input}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}</select></label>
          <label className="block text-sm">Origine<select name="origin" className={input} defaultValue="annonce">{ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABELS[o]}</option>)}</select></label>
          <label className="block text-sm">Campagne (facultatif)<input name="campaign" maxLength={255} className={input} /></label>
          <label className="block text-sm">Référence du dossier (facultatif)<input name="ref" maxLength={12} placeholder="E2B-ABC123" className={input} /></label>
          <button className={btn} disabled={tableMissing}>Enregistrer la conversation</button>
        </form>
      </div>

      <nav className="flex gap-2" aria-label="Période">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`/admin/conversations?jours=${d}`} aria-current={d === days ? "page" : undefined} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${d === days ? "bg-brand-600 text-white" : "bg-white border text-gray-700"}`}>{d} jours</a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="bg-white rounded-2xl p-6 text-sm text-gray-500">Aucune conversation sur cette période.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="bg-white rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="conv-row">
              <div className="min-w-0">
                <strong>{r.kind === "lot" ? `Lot de ${r.conversation_count}` : "Conversation"}</strong> · {CHANNEL_LABELS[r.channel as keyof typeof CHANNEL_LABELS] ?? r.channel} · {ORIGIN_LABELS[r.origin as keyof typeof ORIGIN_LABELS] ?? r.origin}
                {r.campaign ? <span className="text-gray-500"> · {r.campaign}</span> : null}
                <span className="text-gray-600"> · {fmt(r.started_at)}</span>
                <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs">{STAGE_LABELS[r.stage as Stage]}</span>
                {r.status !== "ouverte" && <span className="ml-1 text-xs text-gray-500">({CONV_STATUS_LABELS[r.status as ConvStatus] ?? r.status})</span>}
              </div>
              {r.status !== "annulee" && (
                <form action={cancelConversationAction}><input type="hidden" name="id" value={r.id} /><button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200">Annuler</button></form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
