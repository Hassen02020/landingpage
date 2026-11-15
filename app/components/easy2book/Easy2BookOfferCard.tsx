import type { MouseEvent, ReactNode } from "react"

export interface OfferCardLabels { reserve: string; ask: string; full: string }

/**
 * Carte d'offre complète (destination, date, durée, prestations, prix, places, boutons). Tous les textes et les actions viennent de la page :
 * le composant ne calcule aucun prix et ne suit rien.
 */
export function Easy2BookOfferCard({ name, tag, imageUrl, details, features, priceBefore, price, unit, urgency, soldOut, labels, onReserve, askHref, onAsk, chipClass, priceClass, buttonClass, softClass }: {
  name: string
  tag?: string | null
  imageUrl?: string | null
  details?: string[]
  features?: string[]
  priceBefore?: string | null
  price: string
  unit?: ReactNode
  urgency?: string | null
  soldOut: boolean
  labels: OfferCardLabels
  onReserve: () => void
  askHref: string
  onAsk?: (e: MouseEvent<HTMLAnchorElement>) => void
  chipClass: string
  priceClass: string
  buttonClass: string
  softClass: string
}) {
  return (
    <article className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imageUrl && <img src={imageUrl} alt={name} className="w-full h-44 object-cover" loading="lazy" />}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-black">{name}</h3>
          {tag && <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${chipClass}`}>{tag}</span>}
        </div>
        {details && details.length > 0 && <div className="text-sm text-gray-600 space-y-0.5 mb-3">{details.map((d) => <div key={d}>{d}</div>)}</div>}
        {features && features.length > 0 && <ul className="text-sm text-gray-700 space-y-1 mb-3">{features.map((f) => <li key={f}>✓ {f}</li>)}</ul>}
        <div className="mt-auto">
          {priceBefore && <div className="text-sm text-gray-400 line-through" dir="ltr">{priceBefore} TND</div>}
          <div className={`text-3xl font-black ${priceClass}`}><span dir="ltr">{price}</span> <span className="text-base">TND</span>{unit}</div>
          {urgency && <p className="text-sm font-bold text-red-600 mt-1">🔥 {urgency}</p>}
          {soldOut ? (
            <div className="mt-3 text-center bg-gray-200 text-gray-600 font-black py-3 rounded-2xl">{labels.full}</div>
          ) : (
            <button type="button" onClick={onReserve} className={`mt-3 w-full text-white font-black py-3 rounded-2xl ${buttonClass}`}>{labels.reserve}</button>
          )}
          <a href={askHref} target="_blank" rel="noopener noreferrer" onClick={onAsk} className={`mt-2 block text-center text-sm font-bold py-1 ${softClass}`}>💬 {labels.ask}</a>
        </div>
      </div>
    </article>
  )
}
