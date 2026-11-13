import Link from "next/link"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { loadProfitability } from "@/lib/server/profitability"
import { parsePeriod } from "@/lib/server/stats"
import type { Dimension, GroupRow, Metrics } from "@/lib/ad-economics"
import { isConventionalCampaign } from "@/lib/campaign-name"

export const dynamic = "force-dynamic"

const DIMS: { key: Dimension; label: string }[] = [
  { key: "network", label: "Réseau" }, { key: "campaign", label: "Campagne" }, { key: "product", label: "Produit" }, { key: "niche", label: "Niche" }, { key: "ad", label: "Annonce" },
]
const tnd = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} TND`)
const signed = (n: number) => `${n > 0 ? "+" : ""}${tnd(n)}`

function Card({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "pos" | "neg" | "warn" }) {
  const color = tone === "pos" ? "text-green-700" : tone === "neg" ? "text-red-600" : tone === "warn" ? "text-amber-700" : "text-gray-900"
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  )
}

const tone = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : undefined)

function Row({ r, winner, dim }: { r: GroupRow; winner: boolean; dim: Dimension }) {
  const m: Metrics = r.metrics
  const estSpend = r.spendBasis === "estimee"
  const estCost = r.costBasis === "estimee"
  const est = estSpend || estCost
  const campaignName = dim === "campaign" ? r.key.split("|").slice(1).join("|") : ""
  const offConvention = dim === "campaign" && campaignName !== "(aucune)" && !isConventionalCampaign(campaignName)
  const Est = () => <span className="block text-xs text-amber-700">≈ estimation</span>
  return (
    <tr className={`border-t align-top ${winner ? "bg-green-50" : ""}`}>
      <td className="py-2 pr-3 font-semibold">{r.label}{winner && <span className="ml-2 text-xs font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">Gagnante</span>}
        {!r.sufficient && <span className="block text-xs font-normal text-gray-500">échantillon insuffisant ({m.confirmedBookings} réservation(s) confirmée(s))</span>}
        {est && <span className="block text-xs font-normal text-amber-700">dépense répartie au prorata des leads : estimation, pas une dépense réelle par {dim === "product" ? "produit" : dim === "niche" ? "niche" : "annonce"}</span>}
        {offConvention && <span className="block text-xs font-normal text-red-700">nom hors convention : vérifiez le nom de campagne dans l&apos;annonce</span>}
        {m.bookingsWithoutCommission > 0 && <span className="block text-xs font-normal text-red-700">{m.bookingsWithoutCommission} réservation(s) sans commission importée</span>}
      </td>
      <td className="pr-3 text-right">{m.leads}</td>
      <td className="pr-3 text-right">{m.bookings}<span className="block text-xs text-gray-500">{m.confirmedBookings} confirmée(s)</span></td>
      <td className={`pr-3 text-right ${estSpend ? "text-amber-700" : ""}`}>{estSpend ? "≈ " : ""}{tnd(m.spend)}{estSpend && <Est />}</td>
      <td className={`pr-3 text-right ${estCost ? "text-amber-700" : ""}`}>{estCost ? "≈ " : ""}{tnd(m.variableCosts)}{estCost && <Est />}</td>
      <td className="pr-3 text-right">{tnd(m.commissionConfirmed)}<span className="block text-xs text-amber-700">+ {tnd(m.commissionProvisional)} provisoire</span></td>
      <td className={`pr-3 text-right font-bold ${est ? "text-amber-700" : m.marginConfirmed < 0 ? "text-red-600" : m.marginConfirmed > 0 ? "text-green-700" : ""}`}>{est ? "≈ " : ""}{signed(m.marginConfirmed)}{est && <Est />}</td>
      <td className="pr-3 text-right text-amber-700">≈ {signed(m.marginWithProvisional)}<span className="block text-xs">estimation (provisoire{est ? " + répartition" : ""})</span></td>
      <td className={`text-right ${estSpend ? "text-amber-700" : ""}`}>{estSpend && m.costPerBooking !== null ? "≈ " : ""}{tnd(m.costPerBooking)}</td>
    </tr>
  )
}

export default async function AnalysePage({ searchParams }: { searchParams: { dim?: string; from?: string; to?: string } }) {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "ads.view")) return <p className="bg-white rounded-2xl p-6 text-gray-700">Cette page est réservée aux responsables.</p>
  const dim = (DIMS.find((d) => d.key === searchParams.dim)?.key ?? "campaign") as Dimension
  const period = parsePeriod(searchParams.from, searchParams.to, 30)
  const data = await loadProfitability(period, dim)
  const { result } = data
  const t = result.total.metrics
  const q = (d: string) => `/admin/rentabilite/analyse?dim=${d}&from=${period.from}&to=${period.to}`

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/rentabilite" className="text-sm text-violet-700 font-semibold">← Saisie des dépenses et commissions</Link>
        <h1 className="text-2xl font-black mt-1">Quelles campagnes rapportent réellement de l&apos;argent ?</h1>
        <p className="text-gray-600 text-sm">Une publicité n&apos;est gagnante que si elle rapporte une <strong>marge nette réellement conservée</strong> (commission confirmée − publicité − coûts variables), pas seulement des réservations ou du chiffre d&apos;affaires.</p>
      </div>

      {!data.migrationApplied && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">Les migrations 0016 / 0017 ne sont pas toutes appliquées : certains chiffres sont absents.</div>}

      {t.bookings > 0 && t.bookingsWithoutCommission === t.bookings && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-sm"><strong>Aucune commission importée pour vos {t.bookings} réservation(s).</strong> Sans elles, la marge ci-dessous ne représente pas la rentabilité réelle : Landing n&apos;invente jamais une commission. Importez le fichier d&apos;EasyV4 depuis <Link href="/admin/rentabilite" className="underline font-bold">la page de saisie</Link> (le modèle de fichier y est téléchargeable).</div>
      )}
      {t.bookings > 0 && t.bookingsWithoutCommission > 0 && t.bookingsWithoutCommission < t.bookings && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm"><strong>{t.bookingsWithoutCommission} réservation(s) sur {t.bookings} n&apos;ont aucune commission importée</strong> : la marge est sous-estimée tant qu&apos;elles ne sont pas rapprochées.</div>
      )}
      {(dim === "product" || dim === "niche" || dim === "ad") && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 text-sm">Dans cette vue, la publicité et les coûts de campagne sont <strong>répartis au prorata des prospects</strong> : ce sont des <strong>estimations (≈)</strong>, pas des dépenses réelles par {dim === "product" ? "produit" : dim === "niche" ? "niche" : "annonce"}. Pour des chiffres réels, regardez les vues Réseau et Campagne.</div>
      )}

      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <input type="hidden" name="dim" value={dim} />
        <label>Du<input type="date" name="from" defaultValue={period.from} className="block px-3 py-2 rounded-xl border border-gray-300" /></label>
        <label>Au<input type="date" name="to" defaultValue={period.to} className="block px-3 py-2 rounded-xl border border-gray-300" /></label>
        <button className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold">Appliquer</button>
        <span className="text-xs text-gray-500">Leads créés sur la période ; dépenses et coûts datés sur la période.</span>
      </form>

      <div className="flex flex-wrap gap-2">
        {DIMS.map((d) => <Link key={d.key} href={q(d.key)} className={`px-4 py-2 rounded-xl text-sm font-bold ${d.key === dim ? "bg-violet-700 text-white" : "bg-white border hover:bg-gray-50"}`}>{d.label}</Link>)}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Dépensé pour attirer un client" value={tnd(t.costPerBooking)} note={t.costPerBooking === null ? "non calculable (aucune dépense ou aucune réservation)" : "dépenses ÷ réservations"} />
        <Card label="Réservations confirmées" value={`${t.confirmedBookings} / ${t.bookings}`} note="confirmées = commission confirmée · total = dossiers réservés" />
        <Card label="Commission conservée" value={tnd(t.commissionConfirmed)} note={`+ ${tnd(t.commissionProvisional)} encore provisoire`} tone="warn" />
        <Card label="Reste après tous les coûts" value={signed(t.marginConfirmed)} note="marge nette confirmée (définitive)" tone={tone(t.marginConfirmed)} />
      </div>
      <p className="text-xs text-gray-600">Si les commissions provisoires se confirment, la marge deviendrait <strong>{signed(t.marginWithProvisional)}</strong> — une estimation, pas un bénéfice.{t.variableCosts === 0 && " Aucun coût variable saisi : marge avant coûts variables non saisis."}</p>

      <div className={`rounded-2xl p-4 text-sm border ${result.winnerKey ? "bg-green-50 border-green-200 text-green-900" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
        {result.winnerKey ? <><strong>Gagnante : {result.rows.find((r) => r.key === result.winnerKey)?.label}.</strong> {result.winnerReason}</> : <>{result.winnerReason}</>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs"><th className="py-1 pr-3">{DIMS.find((d) => d.key === dim)?.label}</th><th className="pr-3 text-right">Leads</th><th className="pr-3 text-right">Réservations</th><th className="pr-3 text-right">Publicité</th><th className="pr-3 text-right">Coûts variables</th><th className="pr-3 text-right">Commission</th><th className="pr-3 text-right">Marge confirmée</th><th className="pr-3 text-right">Marge avec provisoire</th><th className="text-right">Coût / réservation</th></tr></thead>
          <tbody>
            {result.rows.length === 0 && <tr><td colSpan={9} className="py-4 text-gray-500">Aucune donnée sur la période.</td></tr>}
            {result.rows.map((r) => <Row key={r.key} r={r} winner={r.key === result.winnerKey} dim={dim} />)}
            {result.rows.length > 0 && (
              <tr className="border-t-2 font-bold"><td className="py-2 pr-3">Total</td><td className="pr-3 text-right">{t.leads}</td><td className="pr-3 text-right">{t.bookings}</td><td className="pr-3 text-right">{tnd(t.spend)}</td><td className="pr-3 text-right">{tnd(t.variableCosts)}</td><td className="pr-3 text-right">{tnd(t.commissionConfirmed)}</td><td className="pr-3 text-right">{signed(t.marginConfirmed)}</td><td className="pr-3 text-right text-amber-700">{signed(t.marginWithProvisional)}</td><td className="text-right">{tnd(t.costPerBooking)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(result.unattachedSpend.length > 0 || result.unattachedCosts !== 0 || result.excludedCostRows > 0 || data.truncated) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm space-y-1">
          {result.unattachedSpend.length > 0 && <p><strong>Dépenses sans lead rattaché</strong> (comptées au total) : {result.unattachedSpend.map((u) => `${u.network} · ${u.campaign} (${tnd(u.amount)})`).join(" ; ")}. Vérifiez que le nom de campagne saisi correspond au paramètre <code>utm_campaign</code>.</p>}
          {result.unattachedCosts !== 0 && <p><strong>Coûts variables non attribués</strong> : {tnd(result.unattachedCosts)} (comptés au total, non répartis).</p>}
          {result.excludedCostRows > 0 && <p>{result.excludedCostRows} ligne(s) de coût écartée(s) (publicité ou remboursement) pour ne pas les compter deux fois.</p>}
          {data.truncated && <p>Plus de 10 000 leads sur la période : réduisez-la, le calcul serait incomplet.</p>}
        </div>
      )}
    </div>
  )
}
