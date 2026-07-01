"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { CATEGORIES } from "./config"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const WHATSAPP_NUMBER = "21698140514"
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Bonjour Easy2Book, je souhaite avoir le tarif pour Summer Vibes 2026 ! 🏖️\n\nMerci de me préciser :\n📅 Date du congés\n👥 Nombre d'adultes\n👶 Âges des enfants\n📍 Zone : Hammamet / Monastir / Sousse / Tabarka / Mahdia / Djerba"
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

// Generate unique event ID for deduplication
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

// Dual transmission function: Browser Pixel + Server CAPI
async function sendEvent(eventName: string, customData: Record<string, unknown>): Promise<void> {
  const eventId = generateEventId()

  // 1. Send to Browser Pixel (existing implementation)
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (eventName === "Contact") {
      window.fbq("track", eventName, { ...customData, eventID: eventId })
    } else {
      window.fbq("trackCustom", eventName, { ...customData, eventID: eventId })
    }
  }

  // 2. Send to Server CAPI (new implementation)
  try {
    await fetch("/api/meta-capi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        customData,
        eventId,
      }),
    })
  } catch (error) {
    console.error("CAPI send failed:", error)
    // Silently fail - browser pixel still works
  }
}

function trackWhatsAppClick(location: string = "general"): void {
  sendEvent("Contact", {
    content_category: "Summer Vibes 2026",
    content_name: location,
    value: 1,
    currency: "TND",
    user_segment: "summer_vibes_visitor"
  })
}

function trackCategoryChange(categoryId: string, categoryName: string): void {
  sendEvent("CategoryView", {
    content_category: "Hotel Category",
    content_name: categoryName,
    category_id: categoryId,
    user_interest: detectUserInterest(categoryName),
    campaign: "summer_vibes_2026"
  })
}

function trackHotelClick(hotelName: string, city: string, category: string): void {
  sendEvent("HotelClick", {
    content_name: hotelName,
    content_category: category,
    city: city,
    destination: "Tunisia",
    travel_type: detectTravelType(category),
    value: 1,
    currency: "TND"
  })
}

function trackScrollDepth(depth: string): void {
  sendEvent("ScrollDepth", {
    depth: depth,
    engagement_level: calculateEngagement(depth),
    page_section: depth
  })
}

function trackPageEngagement(timeOnPage: number): void {
  sendEvent("PageEngagement", {
    time_on_page: timeOnPage,
    engagement_score: calculateEngagementScore(timeOnPage),
    user_intent: detectUserIntent(timeOnPage)
  })
}

function detectUserInterest(category: string): string {
  const interestMap: Record<string, string> = {
    "🏨 Chaîne El Mouradi": "luxury_chain",
    "🏖️ Enfants Gratuits": "family_travel",
    "🌊 Hôtels Aquapark": "family_fun",
    "💕 Voyage de Noces": "honeymoon_couple",
    "👙 Burkini Autorisé": "family_conservative",
    "💰 Bons Plans": "budget_conscious",
    "💼 Business Hotels": "business_traveler"
  }
  return interestMap[category] || "general_traveler"
}

function detectTravelType(category: string): string {
  const typeMap: Record<string, string> = {
    "🏨 Chaîne El Mouradi": "luxury",
    "🏖️ Enfants Gratuits": "family",
    "🌊 Hôtels Aquapark": "family_entertainment",
    "💕 Voyage de Noces": "romantic",
    "👙 Burkini Autorisé": "family",
    "💰 Bons Plans": "budget",
    "💼 Business Hotels": "business"
  }
  return typeMap[category] || "leisure"
}

function calculateEngagement(depth: string): string {
  const levels: Record<string, string> = {
    "25%": "low",
    "50%": "medium",
    "75%": "high",
    "100%": "very_high"
  }
  return levels[depth] || "low"
}

function calculateEngagementScore(timeOnPage: number): number {
  if (timeOnPage < 10) return 1
  if (timeOnPage < 30) return 2
  if (timeOnPage < 60) return 3
  if (timeOnPage < 120) return 4
  return 5
}

function detectUserIntent(timeOnPage: number): string {
  if (timeOnPage < 10) return "browsing"
  if (timeOnPage < 30) return "considering"
  if (timeOnPage < 60) return "interested"
  return "ready_to_book"
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

function CategoriesSection({
  whatsappNumber,
  onCtaClick,
}: {
  whatsappNumber: string
  onCtaClick: (location: string) => void
}) {
  const [active, setActive] = useState("enfant-gratuit")
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

export default function SummerVibesPage() {
  // Scroll depth and page engagement tracking
  useEffect(() => {
    let trackedDepths = new Set<string>()
    let timeOnPage = 0
    let engagementInterval: number

    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      const depth = scrollPercent >= 75 ? "75%" : scrollPercent >= 50 ? "50%" : scrollPercent >= 25 ? "25%" : null
      if (depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth)
        trackScrollDepth(depth)
      }
    }

    // Track page engagement every 30 seconds
    engagementInterval = window.setInterval(() => {
      timeOnPage += 30
      trackPageEngagement(timeOnPage)
    }, 30000)

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.clearInterval(engagementInterval)
    }
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
            src="/logo.png"
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
          <a
            href="tel:+21698140514"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold transition-colors hover:bg-white/10"
            style={{ color: "#fff" }}
          >
            📞 98 140 514 / 97 449 510
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
        style={{ minHeight: "92vh" }}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-bg.jpg"
            alt="Famille en vacances"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10" style={{ backgroundColor: "#f5c242" }} aria-hidden="true" />
        <div className="absolute -bottom-28 -left-16 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: "#f5c242" }} aria-hidden="true" />

        <span
          className="relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
          style={{ backgroundColor: "rgba(245,194,66,0.18)", color: "#f5c242", border: "1px solid rgba(245,194,66,0.35)" }}
        >
          🌴 Été 2026 — Places limitées
        </span>

        <h1 className="relative z-10 text-white font-extrabold leading-tight mb-4" style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)" }}>
          Vos vacances d'été<br />
          <span style={{ color: "#f5c242" }}>commencent ici</span>
        </h1>

        <p className="relative z-10 text-blue-100 text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed">
          Hôtels, voyages de noces, séjours famille et offres exclusives avec réservation rapide sur WhatsApp
        </p>

        {/* Avantages - 4 points clés */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-3xl w-full">
          {[
            { icon: "⚡", text: "Réponse < 15 min" },
            { icon: "💰", text: "Meilleurs prix" },
            { icon: "💳", text: "Paiement simple" },
            { icon: "🎧", text: "Assistance 24/7" },
          ].map((item) => (
            <div
              key={item.text}
              className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(245,194,66,0.3)" }}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-bold text-gray-800 text-center">{item.text}</span>
            </div>
          ))}
        </div>

        <CTAButton
          label="� Réserver sur WhatsApp"
          className="relative z-10 inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl text-lg font-extrabold shadow-2xl transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: "#25D366", color: "#fff" }}
          location="hero"
        />

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40" aria-hidden="true">
          <div className="w-px h-8 rounded-full" style={{ backgroundColor: "#f5c242" }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#f5c242" }} />
        </div>
      </section>

      {/* COMPTEUR URGENCE */}
      <section className="py-8 px-5" style={{ backgroundColor: "#fef3c7" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🔥</span>
            <h3 className="font-extrabold text-lg" style={{ color: "#92400e" }}>Places limitées — Été 2026</h3>
          </div>
          <p className="text-sm mb-4" style={{ color: "#78350f" }}>Fin des promotions dans :</p>
          <div className="flex justify-center gap-4">
            {[
              { value: "02", label: "Jours" },
              { value: "14", label: "Heures" },
              { value: "22", label: "Minutes" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center px-4 py-3 rounded-xl"
                style={{ backgroundColor: "#fff", border: "2px solid #f59e0b" }}
              >
                <span className="text-2xl font-extrabold" style={{ color: "#0f4c81" }}>{item.value}</span>
                <span className="text-xs font-semibold" style={{ color: "#78350f" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREUVE SOCIALE */}
      <section className="py-12 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12 text-center">
            {[
              { value: "4.9/5", label: "Note moyenne", icon: "⭐" },
              { value: "+1200", label: "Réservations", icon: "📅" },
              { value: "+500", label: "Clients satisfaits", icon: "😊" },
              { value: "+50", label: "Destinations", icon: "🌍" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-3xl mb-1">{stat.icon}</span>
                <span className="text-2xl font-extrabold" style={{ color: "#0f4c81" }}>{stat.value}</span>
                <span className="text-sm text-gray-600">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Avis clients */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                name: "Amira B.",
                text: "Réservation rapide, équipe sérieuse. Tout s'est parfaitement déroulé pour notre séjour à Hammamet.",
                rating: 5
              },
              {
                name: "Karim M.",
                text: "Excellent suivi jusqu'au voyage. L'équipe est réactive et les prix sont vraiment compétitifs.",
                rating: 5
              },
              {
                name: "Fatma T.",
                text: "Prix moins cher qu'ailleurs. J'ai réservé pour toute la famille et nous avons adoré notre séjour.",
                rating: 5
              }
            ].map((review) => (
              <div
                key={review.name}
                className="p-6 rounded-2xl shadow-sm border"
                style={{ backgroundColor: "#f8f9fc", borderColor: "#e5e7eb" }}
              >
                <div className="flex items-center gap-1 mb-3">
                  {Array(review.rating).fill(0).map((_, i) => (
                    <span key={i} className="text-yellow-400">⭐</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm mb-4 leading-relaxed">"{review.text}"</p>
                <p className="font-bold text-sm" style={{ color: "#0f4c81" }}>{review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MINI FORMULAIRE LEADS */}
      <section className="py-16 px-5" style={{ backgroundColor: "#f8f9fc" }}>
        <div className="max-w-xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: "#0f4c81" }}>
            Recevez votre devis personnalisé
          </p>
          <h2 className="text-center font-extrabold text-2xl sm:text-3xl mb-6 text-gray-900">
            Quelques informations pour commencer
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const name = (form.elements.namedItem('name') as HTMLInputElement).value
              const phone = (form.elements.namedItem('phone') as HTMLInputElement).value
              const destination = (form.elements.namedItem('destination') as HTMLSelectElement).value
              const budget = (form.elements.namedItem('budget') as HTMLSelectElement).value
              
              const message = encodeURIComponent(
                `Bonjour Easy2Book, je souhaite avoir un devis pour Summer Vibes 2026 !\n\nNom: ${name}\nTéléphone: ${phone}\nDestination: ${destination}\nBudget: ${budget}`
              )
              window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank')
              trackWhatsAppClick('lead-form')
            }}
            className="space-y-4"
          >
            <div>
              <input
                name="name"
                type="text"
                placeholder="Votre nom"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                name="phone"
                type="tel"
                placeholder="Votre numéro de téléphone"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                name="destination"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Destination souhaitée</option>
                <option value="Hammamet">Hammamet</option>
                <option value="Sousse">Sousse</option>
                <option value="Monastir">Monastir</option>
                <option value="Djerba">Djerba</option>
                <option value="Mahdia">Mahdia</option>
                <option value="Tabarka">Tabarka</option>
              </select>
            </div>
            <div>
              <select
                name="budget"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Budget approximatif</option>
                <option value="100-200 TND">100 - 200 TND / nuit</option>
                <option value="200-300 TND">200 - 300 TND / nuit</option>
                <option value="300-500 TND">300 - 500 TND / nuit</option>
                <option value="500+ TND">500+ TND / nuit</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95"
              style={{ backgroundColor: "#25D366", color: "#fff" }}
            >
              🟢 Recevoir mon devis sur WhatsApp
            </button>
          </form>
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

      {/* FAQ */}
      <section className="py-16 px-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: "#0f4c81" }}>
            Questions fréquentes
          </p>
          <h2 className="text-center font-extrabold text-2xl sm:text-3xl mb-10 text-gray-900">
            Tout ce que vous devez savoir
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Comment payer ma réservation ?",
                a: "Vous payez un acompte pour confirmer votre réservation, le reste est réglé directement à l'hôtel à votre arrivée. Simple et sécurisé !"
              },
              {
                q: "Puis-je annuler ma réservation ?",
                a: "Oui, selon les conditions de l'hôtel. Contactez-nous sur WhatsApp et nous vous expliquerons les modalités d'annulation."
              },
              {
                q: "Les enfants sont-ils gratuits ?",
                a: "Certains hôtels offrent la gratuité pour les enfants selon leur âge. Consultez nos catégories 'Enfant Gratuit' ou demandez-nous sur WhatsApp."
              },
              {
                q: "Quand vais-je recevoir ma confirmation ?",
                a: "Vous recevez votre confirmation de réservation par WhatsApp dans les 15 minutes suivant votre paiement d'acompte."
              }
            ].map((item, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl shadow-sm border"
                style={{ backgroundColor: "#f8f9fc", borderColor: "#e5e7eb" }}
              >
                <h3 className="font-bold text-base mb-2" style={{ color: "#0f4c81" }}>{item.q}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-16 px-5 text-center" style={{ background: "linear-gradient(135deg, #0f4c81 0%, #0a3260 100%)" }}>
        <h2 className="text-white font-extrabold text-2xl sm:text-3xl mb-4">Prêt pour l&apos;aventure estivale ?</h2>
        <p className="text-blue-200 mb-8 max-w-md mx-auto">
          Contactez-nous maintenant sur WhatsApp et recevez votre devis personnalisé en quelques minutes.
        </p>
        <CTAButton
          label="� Réserver sur WhatsApp"
          className="inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: "#25D366", color: "#fff" }}
          location="bottom-cta"
        />

        {/* Liens vers autres offres */}
        <div className="mt-12 border-t border-white/20 pt-10">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-6">Découvrez aussi nos autres offres</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
            <a
              href="/omra"
              className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg px-8 py-5 rounded-2xl shadow-xl transition-all hover:scale-105 border-2 border-emerald-400"
            >
              <span className="text-2xl">🕋</span>
              <div className="text-left">
                <div className="text-base font-black">عمرة الصيف 2026</div>
                <div className="text-emerald-200 text-xs font-semibold">3 أفواج — 4 800 TND</div>
              </div>
            </a>
            <a
              href="/voyages-organises"
              className="flex items-center justify-center gap-3 bg-white/15 hover:bg-white/25 text-white font-black text-lg px-8 py-5 rounded-2xl shadow-xl transition-all hover:scale-105 border-2 border-yellow-400"
            >
              <span className="text-2xl">✈️</span>
              <div className="text-left">
                <div className="text-base font-black">Voyages Organisés</div>
                <div className="text-yellow-300 text-xs font-semibold">Turquie · Bali · Égypte · Maroc</div>
              </div>
            </a>
          </div>
        </div>
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
