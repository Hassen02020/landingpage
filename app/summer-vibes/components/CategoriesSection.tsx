"use client"

import { useState } from "react"
import { CATEGORIES } from "../config"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"
import { waText } from "@/lib/wa-text"

interface CategoriesSectionProps {
  whatsappNumber: string
}

export function CategoriesSection({ whatsappNumber }: CategoriesSectionProps) {
  const [active, setActive] = useState("enfant-gratuit")
  const current = CATEGORIES.find((c) => c.id === active)!

  const handleCategoryChange = (catId: string) => {
    setActive(catId)
    const cat = CATEGORIES.find((c) => c.id === catId)
    // chaque catégorie = une niche testée (enfant gratuit, noces, burkini, aquapark…)
    trackEvent("CategoryView", { product: "hotel", niche: catId, content_name: cat?.label, content_category: "hotel" })
  }

  return (
    <section className="py-16 px-5" style={{ backgroundColor: "#f0f4f8" }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: "#0f4c81" }}>
          Trouvez votre séjour idéal
        </p>
        <h2 className="text-center font-extrabold text-2xl sm:text-3xl mb-8 text-gray-900">
          Toutes nos catégories d&apos;hôtels
        </h2>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className="text-xs font-bold px-4 py-2 rounded-full border-2 transition-all"
              style={{
                borderColor: cat.color,
                backgroundColor: active === cat.id ? cat.color : "transparent",
                color: active === cat.id ? "#fff" : cat.color,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {current.hotels.map(({ name, city, tag }) => {
            const msg = encodeURIComponent(waText(
              `Bonjour Easy2Book, je souhaite avoir le tarif pour l'hôtel ${name} (${city}) — promo du mois !`
            ))
            const url = `https://wa.me/${whatsappNumber}?text=${msg}`
            return (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleWhatsAppClick(e, { product: "hotel", location: `hotel-card`, offer: `${name} (${city})`, niche: current.id })}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-gray-100"
              >
                <div className="relative w-full px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, ${current.color} 0%, #0a3260 100%)` }}>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-90">{current.label.split(" ").slice(1).join(" ")}</span>
                  <p className="text-sm font-semibold mt-1">📍 {city}</p>
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <h3 className="font-bold text-base leading-snug mb-2 text-gray-900 group-hover:text-blue-900 transition-colors">
                    {name}
                  </h3>
                  <p className="text-xs font-semibold mb-3" style={{ color: current.color }}>
                    {tag}
                  </p>
                  <div
                    className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold px-4 py-3 rounded-xl self-start shadow-md hover:shadow-lg transition-shadow"
                    style={{ backgroundColor: "#15803d", color: "#fff" }}
                  >
                    💬 Réserver
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
