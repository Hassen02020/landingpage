import type { ReactNode } from "react"
import { isolateNumbers } from "@/lib/design-system/bidi"
import { ambianceForFamily, type Ambiance } from "@/lib/design-system/ambiance"

// Icônes à trait (avion, bouclier, hôtel, boussole) pour les cartes de réassurance
const ICONS = [
  "M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4s-1 0-3.5 3.5L7 6 5 8l6 3-3 3-3-.5L4 15l4 1 1 4 1.5-1-.5-3 3-3 3 6z",
  "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  "M4 21V5l8-2v18M12 7h8v14M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2M3 21h18",
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5 14 14l-5.5 1.5L10 10z",
]
export const Easy2BookIcon = ({ i }: { i: number }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[i % ICONS.length]} /></svg>
)

export interface TrustItem { title: string; text: string }

/** Cartes « ce qui est inclus » / réassurance : variante « icons » (4 colonnes, fond d'ambiance) ou « numbers » (2 colonnes, fond blanc). */
export function Easy2BookTrustSection({ id = "services", title, ariaLabel, items, variant, accentClass, family = "omra", ambiance, heading }: { id?: string; title: string; ariaLabel: string; items: TrustItem[]; variant: "icons" | "numbers"; accentClass: string; family?: string; ambiance?: Ambiance; heading: (t: string) => ReactNode }) {
  const a = ambiance ?? ambianceForFamily(family)
  const icons = variant === "icons"
  return (
    <section id={id} className="max-w-5xl mx-auto px-4 py-6" aria-label={ariaLabel} data-testid="services">
      {heading(title)}
      <div className={`grid grid-cols-1 gap-4 ${icons ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}>
        {items.map((x, i) => (
          <div key={x.title + i} className={`rounded-2xl border p-6 ${icons ? `${a.surface} ${a.line}` : "bg-white border-gray-100"}`}>
            {icons ? <span className={`block ${accentClass}`}><Easy2BookIcon i={i} /></span> : <p className={`text-xs font-black ${accentClass}`} dir="ltr">{String(i + 1).padStart(2, "0")}</p>}
            <h3 className="mt-1 text-lg font-black">{x.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{isolateNumbers(x.text)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
