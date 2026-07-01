"use client"

import { useState } from "react"
import { CATEGORIES } from "../config"

interface CategoriesSectionProps {
  whatsappNumber: string
  onCtaClick: (location: string) => void
}

export function CategoriesSection({ whatsappNumber, onCtaClick }: CategoriesSectionProps) {
  const [active, setActive] = useState("enfant-gratuit")
  const current = CATEGORIES.find((c) => c.id === active)!

  const handleCategoryChange = (catId: string) => {
    setActive(catId)
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
          {current.hotels.map(({ name, city, tag, img }) => {
            const msg = encodeURIComponent(
              `Bonjour Easy2Book, je souhaite avoir le tarif pour l'hôtel ${name} (${city}) — Summer Vibes 2026 !`
            )
            const url = `https://wa.me/${whatsappNumber}?text=${msg}`
            return (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onCtaClick(`hotel-${name}`)}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-gray-100"
              >
                <div className="relative w-full overflow-hidden" style={{ height: "200px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span
                    className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full shadow text-white"
                    style={{ backgroundColor: current.color }}
                  >
                    {current.label.split(" ").slice(0, 2).join(" ")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-2 left-3 text-white text-xs font-semibold">📍 {city}</p>
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <h3 className="font-bold text-base leading-snug mb-2 text-gray-900 group-hover:text-blue-900 transition-colors">
                    {name}
                  </h3>
                  <p className="text-xs font-semibold mb-3" style={{ color: current.color }}>
                    {tag}
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🏊</span>
                    <span className="text-xs text-gray-600">Piscine</span>
                    <span className="text-lg">🍽</span>
                    <span className="text-xs text-gray-600">All inclusive</span>
                  </div>
                  <div
                    className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold px-4 py-3 rounded-xl self-start shadow-md hover:shadow-lg transition-shadow"
                    style={{ backgroundColor: "#25D366", color: "#fff" }}
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
