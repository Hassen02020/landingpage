"use client"

import { useMemo, useState } from "react"
import { HOTEL_PROMOS } from "../data/hotel-promos"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"
import { waText } from "@/lib/wa-text"
import { CITY_PHOTOS } from "../data/city-photos"

const CITIES = ["Toutes", ...Array.from(new Set(HOTEL_PROMOS.map((h) => h.city))).sort((a, b) => a.localeCompare(b, "fr"))]
const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ")

/** Promos hôtels Tunisie : réduction et prix « à partir de » par personne et par nuit (tarif indicatif, confirmé sur WhatsApp). */
export function HotelPromosSection({ whatsappNumber }: { whatsappNumber: string }) {
  const [city, setCity] = useState("Toutes")
  const list = useMemo(
    () => HOTEL_PROMOS.filter((h) => city === "Toutes" || h.city === city).sort((a, b) => b.discount - a.discount || a.priceFrom - b.priceFrom),
    [city]
  )
  return (
    <section className="py-16 px-5 bg-white" id="promos-hotels" aria-labelledby="promos-hotels-titre">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: "#0f4c81" }}>
          Promos du moment
        </p>
        <h2 id="promos-hotels-titre" className="text-center font-extrabold text-2xl sm:text-3xl mb-2 text-gray-900">
          Promos hôtels Tunisie
        </h2>
        <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
          {HOTEL_PROMOS.length} hôtels en promotion. Prix « à partir de » par personne et par nuit : tarif indicatif, confirmé sur WhatsApp selon vos dates.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8" role="group" aria-label="Filtrer par ville">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={city === c}
              onClick={() => {
                setCity(c)
                trackEvent("CategoryView", { product: "hotel", niche: `ville-${c}`, content_name: `Promos hôtels ${c}`, content_category: "hotel" })
              }}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${city === c ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              style={city === c ? { backgroundColor: "#0f4c81" } : undefined}
            >
              {c}
            </button>
          ))}
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((h) => {
            const msg = encodeURIComponent(
              waText(`Bonjour Easy2Book, je souhaite réserver l'hôtel "${h.name}" (${h.city}) — promo -${h.discount}%.\n\nMerci de me préciser :\n- Dates de séjour\n- Nombre d'adultes et d'enfants\n- Formule souhaitée`)
            )
            return (
              <li key={h.name} className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
                {CITY_PHOTOS[h.city.toLowerCase()] && (
                  <div className="relative h-32 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={CITY_PHOTOS[h.city.toLowerCase()]} alt={`Vue de ${h.city}, Tunisie`} loading="lazy" className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div>
                    <h3 className="font-extrabold text-gray-900 leading-snug">{h.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">📍 {h.city}</p>
                  </div>
                  <span className="shrink-0 rounded-xl px-3 py-1.5 text-lg font-black text-white" style={{ backgroundColor: "#be123c" }} aria-label={`Réduction de ${h.discount} pour cent`}>
                    -{h.discount}%
                  </span>
                </div>
                <div className="px-5 pb-4">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">À partir de</p>
                  <p className="text-2xl font-black text-gray-900">
                    {fmt(h.priceFrom)} <span className="text-base font-bold">TND</span>{" "}
                    <span className="text-sm font-semibold text-gray-600">/ personne / nuit</span>
                  </p>
                  {h.note && <p className="mt-2 text-sm font-semibold text-emerald-800">ℹ️ {h.note}</p>}
                </div>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${msg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => handleWhatsAppClick(e, { product: "hotel", location: "hotel-promo", offer: `${h.name} (${h.city})`, niche: `promo-${h.discount}` })}
                  className="mt-auto m-5 mt-0 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: "#15803d" }}
                >
                  💬 Réserver cet hôtel
                </a>
              </li>
            )
          })}
        </ul>
        <p className="text-center text-xs text-gray-600 mt-6">Tarifs indicatifs, susceptibles de varier selon les dates et la disponibilité.</p>
      </div>
    </section>
  )
}
