import type { ReactNode } from "react"
import { ambianceForFamily, type Ambiance } from "@/lib/design-system/ambiance"

/** Titre en deux temps : la partie après « … » est soulignée au jaune Easy2Book. */
export function splitHeadline(h: string): { lead: string; accent: string } | null {
  const cut = h.search(/…|\.\.\./)
  return cut > 0 ? { lead: h.slice(0, cut).trim(), accent: h.slice(cut).replace(/^(…|\.\.\.)\s*/, "") } : null
}

/** Hero « split » : texte à gauche/droite selon la langue, média vertical (vidéo ou photographie) de l'autre côté, mascotte facultative. */
export function Easy2BookHero({ eyebrow, headline, description, priceLine, actions, media, family = "omra", ambiance }: { eyebrow: string; headline: string; description?: string | null; priceLine?: ReactNode; actions: ReactNode; media?: ReactNode; family?: string; ambiance?: Ambiance }) {
  const a = ambiance ?? ambianceForFamily(family)
  const parts = splitHeadline(headline)
  return (
    <header className={`${a.surface} border-b ${a.line}`} data-testid="hero-split">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 grid gap-8 lg:grid-cols-2 items-center">
        <div>
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">{eyebrow}</span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black leading-tight text-gray-900">
            {parts ? <>{parts.lead}… <span className="text-e2b-blue [background-image:linear-gradient(transparent_62%,var(--e2b-yellow)_62%)]">{parts.accent}</span></> : headline}
          </h1>
          {description && <p className="mt-4 text-gray-600 leading-relaxed whitespace-pre-line">{description}</p>}
          {priceLine}
          <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
        </div>
        {media}
      </div>
    </header>
  )
}
