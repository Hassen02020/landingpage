"use client"

import { useState, useTransition } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { addCostAction, voidCostAction, addSpendAction, commitImportAction, confirmCommissionsAction, previewImportAction, voidSpendAction } from "../../rentabilite-actions"
import type { PreviewResult } from "@/lib/server/commissions"
import { COST_CATEGORIES, COST_LABELS } from "@/lib/variable-cost-categories"

interface SpendRow { id: number; date: string; network: string; campaign: string; amount: number; voids: number | null; reference: string | null }
interface CostRowUi { id: number; date: string; category: string; amount: number; voids: number | null; target: string; reference: string | null }
interface ComRow { id: number; leadRef: string | null; reservation: string; kind: string; amount: number; status: "provisoire" | "confirme"; date: string }

const tnd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} TND`
const input = "w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
const STATUS_LABEL: Record<string, string> = { rapproche: "Rapprochée", a_valider: "À valider", ambigu: "Ambiguë — refusée", introuvable: "Dossier introuvable", deja_importee: "Déjà importée", conflit: "Conflit de dossier" }

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60">{pending ? "…" : children}</button>
}

export function RentabiliteClient({ canManage, spend, commissions, costs, costsEnabled }: { canManage: boolean; spend: SpendRow[]; commissions: ComRow[]; costs: CostRowUi[]; costsEnabled: boolean }) {
  const [state, add] = useFormState(addSpendAction, undefined)
  const [cstate, addCost] = useFormState(addCostAction, undefined)
  const costVoided = new Set(costs.filter((c) => c.voids != null).map((c) => c.voids))
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [csv, setCsv] = useState("")
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [validated, setValidated] = useState<string[]>([])
  const voided = new Set(spend.filter((s) => s.voids != null).map((s) => s.voids))
  const err = (k: string) => state?.errors?.[k]
  const cerr = (k: string) => cstate?.errors?.[k]
  const today = new Date().toISOString().slice(0, 10)

  const runPreview = () => start(async () => {
    setMsg(null); setValidated([])
    const r = await previewImportAction(csv)
    if ("fatal" in r && r.fatal) { setPreview(null); setMsg(r.fatal); return }
    setPreview(r as PreviewResult)
  })
  const runCommit = () => start(async () => {
    const r = await commitImportAction(csv, validated)
    if ("fatal" in r) { setMsg(r.fatal); return }
    setMsg(r.message ?? `${r.imported} ligne(s) importée(s), ${r.duplicates} déjà connue(s), ${r.skipped} ignorée(s)${r.failed ? `, ${r.failed} en échec` : ""}. Importées en « provisoire ».`)
    setPreview(null); setCsv("")
  })
  const toggle = (k: string) => setValidated((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-black">Dépenses publicitaires</h2>
        {canManage && (
          <form action={add} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
            <label className="text-sm">Date<input type="date" name="date" max={today} defaultValue={today} required className={input} />{err("date") && <span className="text-red-600 text-xs">{err("date")}</span>}</label>
            <label className="text-sm">Réseau<select name="network" className={input} defaultValue="meta"><option value="meta">Meta</option><option value="tiktok">TikTok</option></select>{err("network") && <span className="text-red-600 text-xs">{err("network")}</span>}</label>
            <label className="text-sm">Campagne<input name="campaign" required maxLength={255} className={input} />{err("campaign") && <span className="text-red-600 text-xs">{err("campaign")}</span>}</label>
            <label className="text-sm">Montant (TND)<input name="amount" inputMode="decimal" required className={input} />{err("amount") && <span className="text-red-600 text-xs">{err("amount")}</span>}</label>
            <label className="text-sm">Référence (facultatif)<input name="reference" maxLength={200} className={input} /></label>
            <div className="md:col-span-5 flex items-center gap-3"><Submit>Enregistrer la dépense</Submit>{state?.message && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</span>}</div>
          </form>
        )}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Date</th><th className="pr-3">Réseau</th><th className="pr-3">Campagne</th><th className="pr-3 text-right">Montant</th><th className="pr-3">Réf.</th><th /></tr></thead>
          <tbody>
            {spend.length === 0 && <tr><td colSpan={6} className="py-3 text-gray-500">Aucune dépense saisie.</td></tr>}
            {spend.map((s) => (
              <tr key={s.id} className={`border-t ${s.voids != null || voided.has(s.id) ? "text-gray-400" : ""}`}>
                <td className="py-1.5 pr-3">{s.date}</td><td className="pr-3">{s.network}</td><td className="pr-3">{s.campaign}{s.voids != null && " (annulation)"}</td><td className="pr-3 text-right">{tnd(s.amount)}</td><td className="pr-3">{s.reference}</td>
                <td>{canManage && s.voids == null && !voided.has(s.id) && <button type="button" disabled={pending} className="text-xs font-bold text-red-600 hover:underline" onClick={() => start(async () => { const r = await voidSpendAction(s.id); setMsg(r.ok ? "Dépense annulée." : r.message ?? "Échec.") })}>Annuler</button>}</td>
              </tr>
            ))}
          </tbody></table></div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-black">Coûts variables (hors publicité)</h2>
        <p className="text-sm text-gray-600">Rattachez un coût à <strong>une réservation</strong> (référence dossier) <strong>ou</strong> à <strong>une campagne</strong>, jamais aux deux : il serait compté deux fois. La publicité se saisit plus haut ; un remboursement client passe par l&apos;import des commissions (il est déjà déduit de la commission nette). Ici : seulement les gestes commerciaux hors commission, frais de paiement, primes, messagerie.</p>
        {canManage && costsEnabled && (
          <form action={addCost} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label className="text-sm">Date<input type="date" name="date" max={today} defaultValue={today} required className={input} />{cerr("date") && <span className="text-red-600 text-xs">{cerr("date")}</span>}</label>
            <label className="text-sm">Catégorie<select name="category" className={input} defaultValue="frais_paiement">{COST_CATEGORIES.map((c) => <option key={c} value={c}>{COST_LABELS[c]}</option>)}</select>{cerr("category") && <span className="text-red-600 text-xs">{cerr("category")}</span>}</label>
            <label className="text-sm">Montant (TND)<input name="amount" inputMode="decimal" required className={input} />{cerr("amount") && <span className="text-red-600 text-xs">{cerr("amount")}</span>}</label>
            <label className="text-sm">Référence (facultatif)<input name="reference" maxLength={200} className={input} /></label>
            <label className="text-sm">Réservation (E2B-XXXXXX)<input name="leadRef" className={input} dir="ltr" />{cerr("leadRef") && <span className="text-red-600 text-xs">{cerr("leadRef")}</span>}</label>
            <label className="text-sm">…ou réseau<select name="network" className={input} defaultValue=""><option value="">—</option><option value="meta">Meta</option><option value="tiktok">TikTok</option></select>{cerr("network") && <span className="text-red-600 text-xs">{cerr("network")}</span>}</label>
            <label className="text-sm">…et campagne<input name="campaign" maxLength={255} className={input} />{cerr("campaign") && <span className="text-red-600 text-xs">{cerr("campaign")}</span>}</label>
            <div className="flex items-end gap-3"><Submit>Enregistrer le coût</Submit></div>
            {cstate?.message && <p className={`md:col-span-4 text-sm ${cstate.ok ? "text-green-700" : "text-red-600"}`}>{cstate.message}</p>}
          </form>
        )}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Date</th><th className="pr-3">Catégorie</th><th className="pr-3">Rattaché à</th><th className="pr-3 text-right">Montant</th><th /></tr></thead>
          <tbody>
            {costs.length === 0 && <tr><td colSpan={5} className="py-3 text-gray-500">Aucun coût variable saisi : la marge affichée est « avant coûts variables non saisis ».</td></tr>}
            {costs.map((c) => (
              <tr key={c.id} className={`border-t ${c.voids != null || costVoided.has(c.id) ? "text-gray-400" : ""}`}>
                <td className="py-1.5 pr-3">{c.date}</td><td className="pr-3">{COST_LABELS[c.category as keyof typeof COST_LABELS] ?? c.category}{c.voids != null && " (annulation)"}</td><td className="pr-3">{c.target}</td><td className="pr-3 text-right">{tnd(c.amount)}</td>
                <td>{canManage && c.voids == null && !costVoided.has(c.id) && <button type="button" disabled={pending} className="text-xs font-bold text-red-600 hover:underline" onClick={() => start(async () => { const r = await voidCostAction(c.id); setMsg(r.ok ? "Coût annulé." : r.message ?? "Échec.") })}>Annuler</button>}</td>
              </tr>
            ))}
          </tbody></table></div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-black">Commissions EasyV4</h2>
        {canManage && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Collez le CSV exporté d&apos;EasyV4 (colonnes : reservation_ref ; nature ; montant_tnd ; date ; lead_ref ; telephone ; ligne). Rien n&apos;est écrit avant l&apos;aperçu et votre validation.</p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} className={input + " font-mono text-xs"} dir="ltr" aria-label="Contenu CSV des commissions" />
            <div className="flex gap-3"><button type="button" disabled={pending || !csv.trim()} onClick={runPreview} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white disabled:opacity-60">Aperçu</button>
              {preview && <button type="button" disabled={pending} onClick={runCommit} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-violet-600 text-white disabled:opacity-60">Importer (provisoire)</button>}</div>
            {preview && (
              <div className="space-y-2">
                <p className="text-sm">{Object.entries(preview.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${STATUS_LABEL[k]}`).join(" · ") || "Aucune ligne exploitable."}</p>
                {preview.errors.length > 0 && <ul className="text-xs text-red-700 list-disc pl-5">{preview.errors.slice(0, 20).map((e) => <li key={e.line}>Ligne {e.line} : {e.error}</li>)}</ul>}
                <table className="w-full text-sm"><tbody>{preview.rows.map((r) => (
                  <tr key={r.lineKey} className="border-t"><td className="py-1.5 pr-3">{r.line}</td><td className="pr-3">{r.reservationRef}</td><td className="pr-3">{r.kind}</td><td className="pr-3 text-right">{tnd(r.amount)}</td><td className="pr-3">{STATUS_LABEL[r.status]}{r.leadRef ? ` — ${r.leadRef}${r.firstName ? ` (${r.firstName})` : ""}` : ""}{r.warning && <span className="block text-xs text-amber-700">{r.warning}</span>}</td>
                    <td>{r.status === "a_valider" && <label className="text-xs"><input type="checkbox" checked={validated.includes(r.lineKey)} onChange={() => toggle(r.lineKey)} /> Valider</label>}</td></tr>))}</tbody></table>
              </div>
            )}
          </div>
        )}
        {msg && <p role="status" className="text-sm text-gray-800 bg-gray-50 border rounded-xl p-3">{msg}</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Date</th><th className="pr-3">Réservation</th><th className="pr-3">Dossier</th><th className="pr-3">Nature</th><th className="pr-3 text-right">Montant</th><th className="pr-3">Statut</th><th /></tr></thead>
          <tbody>
            {commissions.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Aucune commission importée.</td></tr>}
            {commissions.map((c) => (
              <tr key={c.id} className="border-t"><td className="py-1.5 pr-3">{c.date}</td><td className="pr-3">{c.reservation}</td><td className="pr-3">{c.leadRef}</td><td className="pr-3">{c.kind}</td><td className="pr-3 text-right">{tnd(c.amount)}</td>
                <td className="pr-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === "confirme" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{c.status === "confirme" ? "Confirmée" : "Provisoire"}</span></td>
                <td>{canManage && c.status === "provisoire" && <button type="button" disabled={pending} className="text-xs font-bold text-violet-700 hover:underline" onClick={() => start(async () => { const r = await confirmCommissionsAction([c.id]); setMsg(r.message ?? (r.confirmed ? "Commission confirmée." : "Rien à confirmer.")) })}>Confirmer</button>}</td></tr>
            ))}
          </tbody></table></div>
      </section>
    </div>
  )
}
