"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const WHATSAPP_NUMBER = "21698140514"
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Bonjour Easy2Book, je souhaite réserver mes vacances d'été pour la campagne Summer Vibes 2026 !"
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

function trackWhatsAppClick(location: string = "general"): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Contact", { content_category: "Summer Vibes 2026", content_name: location })
  }
}

function trackCategoryChange(categoryId: string, categoryName: string): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", "CategoryView", { content_category: "Hotel Category", content_name: categoryName, category_id: categoryId })
  }
}

function trackHotelClick(hotelName: string, city: string, category: string): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", "HotelClick", { content_name: hotelName, content_category: category, city })
  }
}

function trackScrollDepth(depth: string): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", "ScrollDepth", { depth })
  }
}

function CTAButton({
  label,
  className,
  style,
  location,
}: {
  label: string
  className?: string
  style?: React.CSSProperties
  location?: string
}) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick(location || "general")}
      className={className}
      style={style}
    >
      {label}
    </a>
  )
}

const CATEGORIES = [
  {
    id: "elmouradi",
    label: "🏨 Chaîne El Mouradi",
    color: "#e53e3e",
    hotels: [
      { name: "El Mouradi Hammamet", city: "Hammamet", tag: "All inclusive · Bord de mer · Toboggan", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "El Mouradi Club Kantaoui", city: "Sousse", tag: "All inclusive · Port El Kantaoui · Plage", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "El Mouradi Club Selima", city: "Sousse", tag: "All inclusive · Vue mer · Animclub", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "El Mouradi Port El Kantaoui", city: "Sousse", tag: "All inclusive · Marina · Plage", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "El Mouradi Skanes", city: "Monastir", tag: "All inclusive · Aquapark · Vue mer", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "El Mouradi Cap Mahdia", city: "Mahdia", tag: "All inclusive · Plage privée · Club enfants", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
      { name: "El Mouradi Mahdia", city: "Mahdia", tag: "All inclusive · Bord de mer", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "El Mouradi El Menzah", city: "Hammamet", tag: "All inclusive · Toboggan · Famille", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "El Mouradi Tozeur", city: "Tozeur", tag: "Oasis · Désert · Piscine", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80" },
      { name: "El Mouradi Gammarth", city: "Gammarth", tag: "5★ · Bord de mer · Luxe", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
    ],
  },
  {
    id: "earlybooking",
    label: "⏰ Early Booking",
    color: "#d97706",
    hotels: [
      { name: "Iberostar Selection Eolia Djerba", city: "Djerba", tag: "⚡ -40% avant le 30 Juin · 5★", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
      { name: "Iberostar Mehari Djerba", city: "Djerba", tag: "⚡ -40% avant le 30 Juin · Plage", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80" },
      { name: "Iberostar Selection Kuriat Palace", city: "Monastir", tag: "⚡ -40% avant le 30 Juin · 5★", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "Iberostar Royal El Mansour Thalasso", city: "Mahdia", tag: "⚡ -35% avant le 30 Juin · Thalasso", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "Iberostar Selection Kantaoui Bay", city: "Sousse", tag: "⚡ -35% avant le 30 Juin · 5★", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "Radisson Blu Resort & Thalasso", city: "Hammamet", tag: "⚡ -35% avant le 30 Juin · Thalasso", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "Royal Tulip Taj Sultan", city: "Hammamet", tag: "⚡ -40% avant le 30 Juin · 5★", img: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80" },
      { name: "Eden Yasmine Resort & Spa", city: "Hammamet", tag: "⚡ -30% avant le 30 Juin · Aquapark", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "Novostar Nahrawess Thalasso", city: "Hammamet", tag: "⚡ -30% avant le 30 Juin · Thalasso", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "Iberostar Selection Mirage", city: "Hammamet", tag: "⚡ -40% avant le 30 Juin · 5★", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Eden Club Skanes", city: "Monastir", tag: "⚡ -30% avant le 30 Juin", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "El Mehdi Beach Resort", city: "Mahdia", tag: "⚡ -30% avant le 30 Juin · Plage", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
    ],
  },
  {
    id: "famille",
    label: "👶 Enfant Gratuit",
    color: "#38a169",
    hotels: [
      { name: "Yadis Hammamet", city: "Hammamet", tag: "👶 Enfant -6 ans GRATUIT · All inclusive", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
      { name: "Houda Yasmine Marina & SPA", city: "Hammamet", tag: "👶 1er enfant -6 ans GRATUIT · Spa", img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80" },
      { name: "Nesrine Hammamet", city: "Hammamet", tag: "👶 Enfant -5 ans GRATUIT · Kidclub", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "Pearl Marriott Resort & Spa", city: "Sousse", tag: "👶 Enfant -6 ans GRATUIT · 5★", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Occidental Sousse Marhaba", city: "Sousse", tag: "👶 Enfant -6 ans GRATUIT", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "The Russelior Hotel & SPA", city: "Hammamet", tag: "👶 Enfant -4 ans GRATUIT · 5★", img: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80" },
      { name: "Mövenpick Resort Marine Spa", city: "Sousse", tag: "👶 Enfant -6 ans GRATUIT · 5★", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
      { name: "Hammamet Garden Resort & Spa", city: "Hammamet", tag: "👶 Enfant -5 ans GRATUIT", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "Hilton Skanes Monastir", city: "Monastir", tag: "👶 Enfant -6 ans GRATUIT · 5★", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "Djerba Resort", city: "Djerba", tag: "👶 Enfant -5 ans GRATUIT · Plage", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "Holiday Beach Djerba", city: "Djerba", tag: "👶 Enfant -6 ans GRATUIT", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80" },
    ],
  },
  {
    id: "aquapark",
    label: "🎢 Aquapark",
    color: "#2563eb",
    hotels: [
      { name: "Houda Golf Beach & Aquapark", city: "Monastir", tag: "Toboggan · Aquapark · Plage", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "El Mouradi Hammamet", city: "Hammamet", tag: "Toboggan · All inclusive", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "El Mouradi El Menzah", city: "Hammamet", tag: "Toboggan · Famille · Plage", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "El Mouradi Skanes", city: "Monastir", tag: "Aquapark · Vue mer · All inclusive", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "Thalassa Mahdia Aquapark", city: "Mahdia", tag: "Aquapark · Thalasso · Plage", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "ONE Resort Aqua Park & Spa", city: "Monastir", tag: "Aquapark · Spa · Plage", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
      { name: "Sahara Beach Aqua Park", city: "Monastir", tag: "Aquapark · Bord de mer", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80" },
      { name: "Iberostar Mehari Djerba", city: "Djerba", tag: "Toboggan · All inclusive · Plage", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
      { name: "Royal Jinene", city: "Sousse", tag: "Aquapark · Bord de mer · Famille", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "Zodiac Hammamet", city: "Hammamet", tag: "Toboggan · Plage · Animclub", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Mahdia Beach Aqua Park", city: "Mahdia", tag: "Aquapark · Plage · Famille", img: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80" },
    ],
  },
  {
    id: "noces",
    label: "💑 Voyage de Noces",
    color: "#db2777",
    hotels: [
      { name: "La Badira", city: "Hammamet", tag: "Luxe 5★ · Offre Noces · Spa", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "Royal Azur Thalassa", city: "Hammamet", tag: "5★ · Thalasso · Romantique", img: "https://images.unsplash.com/photo-1535827841776-24afc1e255ac?w=600&q=80" },
      { name: "The Russelior Hotel & SPA", city: "Hammamet", tag: "5★ · Spa · Suite Noces", img: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80" },
      { name: "Steigenberger Marhaba Thalasso", city: "Hammamet", tag: "5★ · Thalasso · Vue mer", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "One Resort Premium", city: "Hammamet", tag: "5★ · Bord de mer · Spa", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "Iberostar Kuriat Palace", city: "Monastir", tag: "5★ · Vue mer · Romantique", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "Hilton Skanes Monastir", city: "Monastir", tag: "5★ · Plage · Suite Noces", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "Royal Thalassa Monastir", city: "Monastir", tag: "5★ · Thalasso · Romantique", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Hasdrubal Prestige Djerba", city: "Djerba", tag: "5★ · Spa · Plage privée", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
      { name: "Iberostar Selection Eolia Djerba", city: "Djerba", tag: "5★ · Plage directe · Luxe", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
      { name: "Anantara Tozeur Resort", city: "Tozeur", tag: "5★ · Désert · Unique au monde", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600&q=80" },
      { name: "Mövenpick Resort Marine Spa", city: "Sousse", tag: "5★ · Spa · Vue mer", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
    ],
  },
  {
    id: "burkini",
    label: "🩱 Burkini Autorisé",
    color: "#7c3aed",
    hotels: [
      { name: "La Playa Hôtel Club", city: "Hammamet", tag: "Burkini autorisé · Plage · Famille", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "Steigenberger Marhaba Thalasso", city: "Hammamet", tag: "Burkini autorisé · 5★ · Thalasso", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "Vincci Marillia", city: "Hammamet", tag: "Burkini autorisé · Bord de mer", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
    ],
  },
  {
    id: "bonsplans",
    label: "💰 Bons Plans",
    color: "#d97706",
    hotels: [
      { name: "Sol Azur Beach Congres", city: "Hammamet", tag: "Meilleur rapport qualité/prix", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "Dar Khayam", city: "Hammamet", tag: "Aquapark · Bon plan famille", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Iberostar Averroes", city: "Hammamet", tag: "All inclusive · Bon plan", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "Djerba Aqua Resort", city: "Djerba", tag: "Aquapark · Plage · Bon plan", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
      { name: "Royal Azur Thalassa", city: "Hammamet", tag: "Thalasso · Bon plan", img: "https://images.unsplash.com/photo-1535827841776-24afc1e255ac?w=600&q=80" },
      { name: "Riadh Palms Resort & Spa", city: "Sousse", tag: "Plage · Spa · Bon plan", img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80" },
      { name: "Hasdrubal Thalassa Hammamet", city: "Hammamet", tag: "Thalasso · Bon plan", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "Occidental Sousse Marhaba", city: "Sousse", tag: "Plage · All inclusive · Bon plan", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "The Orangers Beach Resort", city: "Hammamet", tag: "Bungalows · Plage · Bon plan", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "Iberostar Selection Eolia Djerba", city: "Djerba", tag: "5★ · Bon plan early booking", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
    ],
  },
  {
    id: "business",
    label: "💼 Business Hotels",
    color: "#0f4c81",
    hotels: [
      { name: "Mövenpick Hotel du Lac", city: "Tunis", tag: "Business · Lac · 5★", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80" },
      { name: "Mövenpick Hotel Gammarth", city: "Tunis", tag: "Business · Bord de mer · 5★", img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&q=80" },
      { name: "The Residence Tunis", city: "Tunis", tag: "Luxe · Business · Spa", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80" },
      { name: "Sheraton Tunis Hotel", city: "Tunis", tag: "Business · Conférences · 5★", img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80" },
      { name: "Barceló Concorde Les Berges", city: "Tunis", tag: "Business · Lac · 4★", img: "https://images.unsplash.com/photo-1540541338537-41e2a5e6b5b6?w=600&q=80" },
      { name: "Laico Tunis SPA & Conference", city: "Tunis", tag: "Business · Conférences · Spa", img: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=600&q=80" },
      { name: "Golden Tulip El Mechtel", city: "Tunis", tag: "Business · Centre-ville · 4★", img: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80" },
      { name: "Novotel Tunis Mohamed V", city: "Tunis", tag: "Business · Conférences", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80" },
      { name: "Regency Tunis Hotel", city: "Tunis", tag: "Business · Lac · 5★", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
      { name: "Belvédère Fourati", city: "Tunis", tag: "Business · Centre Tunis", img: "https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=600&q=80" },
    ],
  },
]

function CategoriesSection({
  whatsappNumber,
  onCtaClick,
}: {
  whatsappNumber: string
  onCtaClick: (location: string) => void
}) {
  const [active, setActive] = useState("famille")
  const current = CATEGORIES.find((c) => c.id === active)!

  const handleCategoryChange = (catId: string, catLabel: string) => {
    setActive(catId)
    trackCategoryChange(catId, catLabel)
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
              onClick={() => handleCategoryChange(cat.id, cat.label)}
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
                onClick={() => {
                  trackHotelClick(name, city, current.label)
                  onCtaClick(`hotel-${name}`)
                }}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-gray-100"
              >
                <div className="relative w-full overflow-hidden" style={{ height: "170px" }}>
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
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
                  <p className="absolute bottom-2 left-3 text-white text-xs font-semibold">📍 {city}</p>
                </div>
                <div className="flex flex-col flex-1 p-4">
                  <h3 className="font-bold text-sm leading-snug mb-1 text-gray-900 group-hover:text-blue-900 transition-colors">
                    {name}
                  </h3>
                  <p className="text-xs font-semibold mb-3" style={{ color: current.color }}>
                    {tag}
                  </p>
                  <div
                    className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl self-start"
                    style={{ backgroundColor: "#f5c242", color: "#0f4c81" }}
                  >
                    💬 Demander le tarif
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

export default function SummerVibesPage() {
  // Scroll depth tracking
  useEffect(() => {
    let trackedDepths = new Set<string>()

    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      const depth = scrollPercent >= 75 ? "75%" : scrollPercent >= 50 ? "50%" : scrollPercent >= 25 ? "25%" : null
      if (depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth)
        trackScrollDepth(depth)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen font-sans bg-white text-gray-900">

      {/* HEADER */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 shadow-md"
        style={{ backgroundColor: "#0f4c81" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Easy2Book Logo"
            width={44}
            height={44}
            className="rounded-full object-contain bg-white p-0.5"
            priority
          />
          <div className="leading-tight">
            <p className="text-white font-extrabold text-lg tracking-tight leading-none">Easy2Book</p>
            <p className="text-yellow-300 text-xs font-medium tracking-widest uppercase">Centrale de Réservation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://www.facebook.com/Easy2Bookplateforme"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Suivez-nous sur Facebook"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <CTAButton
            label="💬 Réserver"
            className="hidden sm:inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-transform active:scale-95"
            style={{ backgroundColor: "#f5c242", color: "#0f4c81" }}
            location="header"
          />
        </div>
      </header>

      {/* HERO */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-5 pt-16 pb-20 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0f4c81 0%, #0a3260 60%, #071e3d 100%)", minHeight: "92vh" }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <Image
            src="/logo.jpg"
            alt=""
            width={520}
            height={520}
            className="object-contain select-none"
            style={{ opacity: 0.04, filter: "brightness(10)" }}
          />
        </div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10" style={{ backgroundColor: "#f5c242" }} aria-hidden="true" />
        <div className="absolute -bottom-28 -left-16 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: "#f5c242" }} aria-hidden="true" />

        <span
          className="relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
          style={{ backgroundColor: "rgba(245,194,66,0.18)", color: "#f5c242", border: "1px solid rgba(245,194,66,0.35)" }}
        >
          ☀️ Offre Exclusive — Été 2026
        </span>

        <h1 className="relative z-10 text-white font-extrabold leading-tight mb-4" style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)" }}>
          Summer Vibes<br />
          <span style={{ color: "#f5c242" }}>Tunisia 2026</span>
        </h1>

        <p className="relative z-10 text-blue-100 text-lg sm:text-xl max-w-lg mb-8 leading-relaxed">
          Réservez votre hôtel à <strong className="text-white">Hammamet, Sousse ou Djerba</strong> en quelques secondes — au{" "}
          <strong className="text-white">meilleur prix garanti</strong>, avec Easy2Book.
        </p>

        <div
          className="relative z-10 flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-8 shadow-lg"
          style={{ backgroundColor: "rgba(245,194,66,0.15)", border: "1.5px solid rgba(245,194,66,0.45)" }}
        >
          <span className="text-2xl">💳</span>
          <div className="text-left">
            <p className="text-white font-extrabold text-sm leading-none mb-0.5">Payez une avance · Le reste à l&apos;hôtel</p>
            <p className="text-blue-200 text-xs">Confirmez votre séjour dès maintenant, sans payer la totalité</p>
          </div>
        </div>

        <CTAButton
          label="💬 Planifier mes vacances sur WhatsApp"
          className="relative z-10 inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl text-lg font-extrabold shadow-2xl transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: "#f5c242", color: "#0f4c81" }}
          location="hero"
        />

        <a
          href="https://www.facebook.com/Easy2Bookplateforme"
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:bg-white/20 active:scale-95 mt-4"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Suivez-nous sur Facebook
        </a>

        <p className="relative z-10 text-blue-300 text-sm mt-5">🔒 Réponse en moins de 15 min · Paiement sécurisé</p>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40" aria-hidden="true">
          <div className="w-px h-8 rounded-full" style={{ backgroundColor: "#f5c242" }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#f5c242" }} />
        </div>
      </section>

      {/* AVANTAGES */}
      <section className="py-16 px-5" style={{ backgroundColor: "#f8f9fc" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: "#0f4c81" }}>
            Pourquoi Easy2Book ?
          </p>
          <h2 className="text-center font-extrabold text-2xl sm:text-3xl mb-10 text-gray-900">
            Votre agence de confiance pour l&apos;été
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { emoji: "💳", title: "Payez une avance — Le reste à l'hôtel", desc: "Bloquez votre chambre avec un simple acompte. Vous réglez le solde directement à l'arrivée. Zéro stress.", highlight: true },
              { emoji: "🏷️", title: "Meilleurs Prix Garantis", desc: "Nous négocions pour vous les tarifs les plus bas directement auprès des hôtels partenaires.", highlight: false },
              { emoji: "🎧", title: "Support Local 24/7", desc: "Une équipe tunisienne à votre écoute à toute heure sur WhatsApp pour répondre à chaque question.", highlight: false },
              { emoji: "🏖️", title: "Hammamet · Sousse · Djerba", desc: "Large sélection d'hôtels dans les plus belles destinations balnéaires de Tunisie.", highlight: false },
            ].map(({ emoji, title, desc, highlight }) => (
              <div
                key={title}
                className="flex flex-col items-center text-center rounded-2xl p-7 shadow-sm border hover:shadow-md transition-shadow"
                style={highlight ? { backgroundColor: "#0f4c81", borderColor: "#f5c242", borderWidth: 2 } : { backgroundColor: "#fff", borderColor: "#f3f4f6" }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-4 shadow" style={{ backgroundColor: highlight ? "rgba(245,194,66,0.2)" : "rgba(245,194,66,0.15)" }}>
                  {emoji}
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: highlight ? "#f5c242" : "#0f4c81" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: highlight ? "#bfdbfe" : "#6b7280" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATÉGORIES HÔTELS */}
      <CategoriesSection whatsappNumber={WHATSAPP_NUMBER} onCtaClick={trackWhatsAppClick} />

      {/* BOTTOM CTA */}
      <section className="py-16 px-5 text-center" style={{ background: "linear-gradient(135deg, #0f4c81 0%, #0a3260 100%)" }}>
        <h2 className="text-white font-extrabold text-2xl sm:text-3xl mb-4">Prêt pour l&apos;aventure estivale ?</h2>
        <p className="text-blue-200 mb-8 max-w-md mx-auto">
          Contactez-nous maintenant sur WhatsApp et recevez votre devis personnalisé en quelques minutes.
        </p>
        <CTAButton
          label="💬 Je réserve sur WhatsApp"
          className="inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: "#f5c242", color: "#0f4c81" }}
          location="bottom-cta"
        />
      </section>

      {/* FOOTER */}
      <footer className="py-6 px-5 text-center text-xs text-white/60" style={{ backgroundColor: "#071e3d" }}>
        © {new Date().getFullYear()} Easy2Book — Centrale de Réservation &nbsp;|&nbsp;
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition-colors" onClick={() => trackWhatsAppClick("footer")}>
          +216 98 140 514
        </a>
        &nbsp;|&nbsp;
        <a href="https://www.facebook.com/Easy2Bookplateforme" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white transition-colors">
          Facebook
        </a>
      </footer>

      {/* FLOATING WHATSAPP */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick("floating")}
        aria-label="Nous contacter sur WhatsApp"
        className="fixed bottom-6 right-5 z-50 flex items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: "#25D366", width: "60px", height: "60px" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="white" aria-hidden="true">
          <path d="M16.003 2.667C8.637 2.667 2.667 8.637 2.667 16c0 2.37.635 4.664 1.84 6.672L2.667 29.333l6.88-1.806A13.28 13.28 0 0 0 16.003 29.333c7.363 0 13.33-5.97 13.33-13.333S23.366 2.667 16.003 2.667zm0 24c-2.18 0-4.31-.588-6.168-1.703l-.441-.263-4.082 1.071 1.09-3.967-.288-.457A10.636 10.636 0 0 1 5.333 16c0-5.882 4.787-10.667 10.67-10.667S26.667 10.118 26.667 16 21.882 26.667 16.003 26.667zm5.843-7.984c-.32-.16-1.893-.934-2.187-1.04-.294-.107-.508-.16-.721.16-.214.32-.828 1.04-.015 1.254-.826-.027-1.654-.214-2.373-.614-.64-.36-1.2-.867-1.627-1.467-.427-.6-.694-1.28-.76-1.987-.067-.694.107-1.4.48-1.987.374-.586.934-1.04 1.574-1.28.64-.24 1.334-.267 1.987-.08.654.187 1.254.56 1.72 1.08.467.52.8 1.16.947 1.84l.08.4c.027.16.04.32.04.48 0 .294-.04.587-.12.867-.08.28-.214.547-.387.787-.174.24-.387.44-.627.6-.24.16-.507.267-.787.32-.28.053-.56.053-.84 0-.64-.107-1.24-.4-1.72-.84l-.08-.067c.267.4.587.76.96 1.067.827.693 1.84 1.12 2.907 1.227.373.04.747.013 1.107-.08.36-.093.706-.253 1.013-.467.306-.213.573-.48.787-.787.213-.306.373-.64.48-.986.106-.347.16-.707.16-1.067 0-.387-.04-.773-.12-1.147l-.04-.16c-.133-.64-.373-1.253-.72-1.8-.347-.547-.8-1.027-1.333-1.413-.533-.387-1.12-.653-1.747-.8a5.48 5.48 0 0 0-1.893-.107c-.64.08-1.253.28-1.813.587-.56.307-1.053.72-1.453 1.213-.4.494-.693 1.054-.853 1.654-.16.6-.187 1.227-.08 1.84.107.613.347 1.2.7 1.72.354.52.813.96 1.347 1.28.534.32 1.12.52 1.733.587.614.067 1.24 0 1.827-.187.587-.187 1.12-.507 1.573-.933.454-.427.8-.947 1.027-1.52.227-.573.32-1.2.267-1.813z" />
        </svg>
        <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: "#25D366" }} aria-hidden="true" />
      </a>

    </div>
  )
}
