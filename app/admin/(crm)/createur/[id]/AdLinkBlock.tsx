"use client"

import { useEffect, useMemo, useState } from "react"
import { LINK_SOURCES, buildLink } from "@/lib/links"
import { isConventionalCampaign, suggestCampaignName } from "@/lib/campaign-name"
import { checkDestinationAction } from "@/app/admin/liens-actions"
import type { PageStatus } from "@/lib/page-status"
import type { LinkCheck } from "@/lib/server/link-check"
import { CopyButton } from "../../liens/LinkBuilder"

const TONE = { ok: "bg-green-100 text-green-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" } as const
const CHECK_TONE: Record<string, string> = { ok: "text-green-700", timeout: "text-amber-700", unverified: "text-amber-700" }

/** BLOC « LIEN PUBLICITAIRE » : réutilise le générateur existant (buildLink, LINK_SOURCES, CopyButton). Aucun lien « prêt » si la page est masquée, sans offre valide, ou ne répond pas. */
export function AdLinkBlock({ path, defaultCampaign, status, base }: { path: string; defaultCampaign: string; status: PageStatus; base: string }) {
  const [source, setSource] = useState("facebook")
  const src = LINK_SOURCES.find((s) => s.id === source)!
  const [medium, setMedium] = useState("paid")
  const effMedium = src.mediums.some((m) => m.id === medium) ? medium : src.mediums[0].id
  const [campaign, setCampaign] = useState(defaultCampaign)
  const [content, setContent] = useState("")
  const [dynamic, setDynamic] = useState(false)
  const canDynamic = effMedium === "paid" && Boolean(src.dynamic)
  const [check, setCheck] = useState<LinkCheck | null>(null)
  const [busy, setBusy] = useState(false)

  async function verify() {
    setBusy(true)
    try { setCheck(await checkDestinationAction(path)) } finally { setBusy(false) }
  }
  useEffect(() => { if (status.ok) void verify() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [path, status.ok])

  const result = useMemo(() => buildLink({ path, source, medium: effMedium, campaign, content, dynamic: dynamic && canDynamic }, [{ path, label: path }], base), [path, source, effMedium, campaign, content, dynamic, canDynamic, base])
  const ready = status.ok && check?.state === "ok"
  const conv = campaign === "" || isConventionalCampaign(campaign)
  const input = "w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"

  return (
    <section className="bg-white rounded-2xl border p-5 space-y-4" aria-label="Lien publicitaire" data-testid="ad-link-block" data-ready={ready}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-black">Lien publicitaire</h2>
        <span title={status.detail} className={`px-2 py-0.5 rounded-full text-xs font-bold ${TONE[status.tone]}`} data-testid="page-status">{status.label}</span>
      </div>

      {!status.ok && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{status.detail} <strong>Aucun lien n&apos;est proposé tant que ce problème n&apos;est pas réglé.</strong></div>}

      {status.ok && (
        <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="link-check">
          <span className={`font-bold ${CHECK_TONE[check?.state ?? "unverified"] ?? "text-red-700"}`}>{busy || !check ? "Vérification de la page publique…" : check.message}</span>
          {check?.location && <span className="text-gray-500" dir="ltr">→ {check.location}</span>}
          <button type="button" onClick={verify} disabled={busy} className="rounded-lg border px-3 py-1.5 font-semibold hover:bg-gray-50 disabled:opacity-50">Tester le lien</button>
          {check && <span className="text-xs text-gray-500" dir="ltr">{check.checkedUrl}</span>}
        </div>
      )}

      {status.ok && check && check.state !== "ok" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {check.state === "timeout" || check.state === "unverified" ? "La page n'a pas pu être vérifiée : relancez le test avant de diffuser le lien." : "La page ne répond pas normalement : le lien n'est pas présenté comme prêt."}
        </div>
      )}

      {ready && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <label className="block"><span className="font-bold">Réseau</span>
              <select value={source} onChange={(e) => { setSource(e.target.value); setDynamic(false); setMedium(LINK_SOURCES.find((s) => s.id === e.target.value)!.mediums[0].id === "paid" ? "paid" : "") }} className={`${input} mt-1`} aria-label="Réseau publicitaire">
                {LINK_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="font-bold">Support</span>
              <select value={effMedium} onChange={(e) => setMedium(e.target.value)} className={`${input} mt-1`} aria-label="Support">
                {src.mediums.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            {!(dynamic && canDynamic) && (
              <>
                <label className="block"><span className="font-bold">Nom de la campagne</span>
                  <input value={campaign} onChange={(e) => setCampaign(e.target.value)} className={`${input} mt-1`} aria-label="Nom de la campagne" dir="ltr" />
                </label>
                <label className="block"><span className="font-bold">Contenu / visuel (facultatif)</span>
                  <input value={content} onChange={(e) => setContent(e.target.value)} className={`${input} mt-1`} aria-label="Contenu" dir="ltr" />
                </label>
              </>
            )}
          </div>
          {!conv && <p className="text-xs text-amber-700">Nom hors convention (minuscules, chiffres, tirets). Proposition : <button type="button" className="underline font-bold" onClick={() => setCampaign(suggestCampaignName(campaign))}>{suggestCampaignName(campaign)}</button>. Utilisez le même nom dans la plateforme publicitaire et dans les dépenses.</p>}
          {canDynamic && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} className="mt-1" aria-label="Paramètres dynamiques" />
              <span><span className="font-bold">Paramètres dynamiques</span> — la plateforme remplit campagne, groupe et annonce toute seule (recommandé).</span></label>
          )}
          {source === "google" && <p className="text-xs text-gray-600">Google Ads : activez le <strong>balisage automatique</strong> dans votre compte ; collez ce lien comme « URL finale ». La conservation du identifiant de clic Google sur le prospect n&apos;est pas encore disponible.</p>}
          {result.ok ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-800">Lien prêt à coller</div>
              <div className="flex items-start gap-2">
                <code data-testid="generated-link" className="min-w-0 flex-1 break-all text-sm select-all" dir="ltr">{result.url}</code>
                <CopyButton text={result.url} />
              </div>
              <p className="mt-2 text-xs text-green-900">Collez ce lien tel quel dans la publicité : ne modifiez pas l&apos;adresse.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">{Object.values(result.errors).join(" ")}</div>
          )}
        </>
      )}
    </section>
  )
}
