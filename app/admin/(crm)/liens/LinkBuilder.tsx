"use client"

import { useMemo, useState } from "react"
import { LINK_SOURCES, buildLink, type Destination } from "@/lib/links"
import { isConventionalCampaign, suggestCampaignName } from "@/lib/campaign-name"

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* presse-papiers indisponible : le lien reste sélectionnable */
        }
      }}
      className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
    >
      {done ? "Copié ✓" : label}
    </button>
  )
}

export function LinkBuilder({ destinations, base }: { destinations: Destination[]; base: string }) {
  const [source, setSource] = useState("instagram")
  const [medium, setMedium] = useState("bio")
  const [path, setPath] = useState("/")
  const [campaign, setCampaign] = useState("")
  const [content, setContent] = useState("")
  const [dynamic, setDynamic] = useState(false)

  const src = LINK_SOURCES.find((s) => s.id === source)!
  const mediums = src.mediums
  const effectiveMedium = mediums.some((m) => m.id === medium) ? medium : mediums[0].id
  const canDynamic = effectiveMedium === "paid" && Boolean(src.dynamic)
  const result = useMemo(
    () => buildLink({ path, source, medium: effectiveMedium, campaign, content, dynamic: dynamic && canDynamic }, destinations, base),
    [path, source, effectiveMedium, campaign, content, dynamic, canDynamic, destinations, base]
  )
  const input = "w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
  // AVERTISSEMENT seulement (jamais de correction automatique) : un ancien lien avec tiret bas reste valide et inchangé
  const usedCampaign = result.ok ? result.params.utm_campaign : undefined
  const offConvention = Boolean(usedCampaign) && !isConventionalCampaign(usedCampaign as string)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <label className="block"><span className="font-bold">Réseau</span>
          <select value={source} onChange={(e) => { setSource(e.target.value); setDynamic(false) }} className={`${input} mt-1`} aria-label="Réseau">
            {LINK_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="block"><span className="font-bold">Support</span>
          <select value={effectiveMedium} onChange={(e) => setMedium(e.target.value)} className={`${input} mt-1`} aria-label="Support">
            {mediums.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="block"><span className="font-bold">Page de destination</span>
          <select value={path} onChange={(e) => setPath(e.target.value)} className={`${input} mt-1`} aria-label="Page de destination">
            {destinations.map((d) => <option key={d.path} value={d.path}>{d.label} — {d.path}</option>)}
          </select>
        </label>
        {!(dynamic && canDynamic) && (
          <>
            <label className="block"><span className="font-bold">Nom de la campagne</span>
              <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={effectiveMedium === "bio" ? "bio (par défaut)" : "ex. omra-ramadan-2027"} className={`${input} mt-1`} aria-label="Nom de la campagne" />
            </label>
            <label className="block"><span className="font-bold">Contenu / visuel (facultatif)</span>
              <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="ex. video-groupe" className={`${input} mt-1`} aria-label="Contenu" />
            </label>
          </>
        )}
        {canDynamic && (
          <label className="flex items-start gap-2 self-end pb-2">
            <input type="checkbox" checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} className="mt-1" aria-label="Paramètres dynamiques" />
            <span><span className="font-bold">Paramètres dynamiques</span><br /><span className="text-xs text-gray-500">La plateforme remplit campagne, groupe et annonce toute seule (recommandé).</span></span>
          </label>
        )}
      </div>

      {result.ok && offConvention && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status" data-testid="naming-warning">
          Nom de campagne hors convention (minuscules, chiffres et tirets, sans tiret bas ni accent). Le lien fonctionne tel quel et les anciens liens ne sont pas modifiés ; pour une <strong>nouvelle</strong> campagne, préférez <code dir="ltr">{suggestCampaignName(usedCampaign as string)}</code> et utilisez le même nom dans la plateforme publicitaire et dans les dépenses.
        </p>
      )}
      {result.ok ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-800">Lien prêt à coller</div>
          <div className="flex items-start gap-2">
            <code data-testid="generated-link" className="min-w-0 flex-1 break-all text-sm select-all" dir="ltr">{result.url}</code>
            <CopyButton text={result.url} />
          </div>
          {dynamic && canDynamic && <p className="mt-2 text-xs text-green-900">Collez ce lien tel quel dans « Paramètres d&apos;URL » / l&apos;adresse de la publicité : ne modifiez pas les accolades ni les doubles tirets bas.</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          {Object.values(result.errors).join(" ")}
        </div>
      )}
    </div>
  )
}

export { CopyButton }
