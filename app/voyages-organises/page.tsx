"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const WHATSAPP_NUMBER = "21698140514"
const PHONE_NUMBER = "98140514"

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

async function sendEvent(eventName: string, customData: Record<string, unknown>): Promise<void> {
  const eventId = generateEventId()
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (eventName === "Contact") {
      window.fbq("track", eventName, { ...customData, eventID: eventId })
    } else {
      window.fbq("trackCustom", eventName, { ...customData, eventID: eventId })
    }
  }
  try {
    await fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, customData, eventId }),
    })
  } catch (e) {
    console.error("CAPI error:", e)
  }
}

function trackWhatsAppClick(location: string, tripName: string = "") {
  sendEvent("Contact", {
    content_category: "Voyages Organises 2026",
    content_name: location,
    content_ids: tripName,
    value: 1,
    currency: "TND",
  })
}

const VOYAGES = [
  {
    id: "istanbul-ete",
    flag: "🇹🇷",
    destination: "Turquie",
    title: "Istanbul Été 2026",
    duree: "7 jours / 6 nuits",
    color: "#C0392B",
    bg: "from-red-700 to-red-900",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Hôtel Istanbul LPD", "⛵ Croisière Bosphore", "🛍️ Shopping Olivium"],
    departures: [
      { depart: "06/07/2026", retour: "12/07/2026" },
    ],
    description: "Istanbul, la ville entre deux continents — Bosphore, Grand Bazar, mosquées majestueuses et shopping inoubliable.",
  },
  {
    id: "kl-bali-juillet",
    flag: "🇲🇾",
    destination: "Malaisie & Bali",
    title: "Kuala Lumpur & Bali",
    duree: "13 jours / 10 nuits",
    color: "#1a6b3c",
    bg: "from-emerald-700 to-teal-900",
    image: "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Royal Chulan KL 5★", "🌴 Bliss Ubud Spa Resort", "🏖️ Rama Beach Resort Kuta"],
    departures: [
      { depart: "07/07/2026", retour: "19/07/2026" },
      { depart: "14/07/2026", retour: "26/07/2026" },
      { depart: "21/07/2026", retour: "02/08/2026" },
      { depart: "28/07/2026", retour: "09/08/2026" },
      { depart: "04/08/2026", retour: "16/08/2026" },
      { depart: "11/08/2026", retour: "23/08/2026" },
      { depart: "18/08/2026", retour: "30/08/2026" },
      { depart: "25/08/2026", retour: "06/09/2026" },
      { depart: "01/09/2026", retour: "13/09/2026" },
      { depart: "08/09/2026", retour: "20/09/2026" },
      { depart: "15/09/2026", retour: "27/09/2026" },
    ],
    description: "KL moderne + Bali mystique — Tours Petronas, rizières d'Ubud, temples balinais et plages paradisiaques de Kuta.",
  },
  {
    id: "antalya-istanbul",
    flag: "🇹🇷",
    destination: "Turquie",
    title: "Antalya & Istanbul 2026",
    duree: "8 jours / 7 nuits",
    color: "#C0392B",
    bg: "from-red-600 to-red-900",
    image: "https://images.unsplash.com/photo-1589561253898-768105ca91a8?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Club Falcon Antalya 4★ All Inc", "🏨 Hôtel Istanbul LPD", "🌊 Chutes Düden · Croisière Bosphore"],
    departures: [
      { depart: "21/07/2026", retour: "28/07/2026" },
    ],
    description: "Plages ensoleillées d'Antalya + magie d'Istanbul — Méditerranée, bazars animés et panoramas époustouflants.",
  },
  {
    id: "sharm-caire",
    flag: "🇪🇬",
    destination: "Égypte",
    title: "Sharm El Sheikh & Le Caire",
    duree: "8 jours / 7 nuits",
    color: "#D4A017",
    bg: "from-amber-600 to-amber-900",
    image: "https://images.unsplash.com/photo-1539768942893-daf53e448371?w=800&q=80",
    highlights: ["✈️ Vol Egyptair", "🏨 Barcelo Tiran Sharm Soft All Inc", "🏨 Radisson Blu Heliopolis Caire", "🔺 Pyramides + Diner sur le Nil"],
    departures: [
      { depart: "22/07/2026", retour: "29/07/2026" },
    ],
    description: "Mer Rouge cristalline à Sharm + splendeurs des Pharaons au Caire — Pyramides, Khan el Khalili et diner gala sur le Nil.",
  },
  {
    id: "marmaris-istanbul",
    flag: "🇹🇷",
    destination: "Turquie",
    title: "Marmaris & Istanbul 2026",
    duree: "8 jours / 7 nuits",
    color: "#C0392B",
    bg: "from-blue-700 to-blue-900",
    image: "https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Emre 4★ All Inc Marmaris", "🏨 Hôtel Istanbul LPD", "⛵ Bateau Marmaris · Bosphore"],
    departures: [
      { depart: "25/07/2026", retour: "01/08/2026" },
    ],
    description: "Eaux turquoise de Marmaris + charme ottoman d'Istanbul — Plages de la mer Égée, Grand Bazar et Sainte-Sophie.",
  },
  {
    id: "maroc-ete",
    flag: "🇲🇦",
    destination: "Maroc",
    title: "Maroc Été 2026",
    duree: "7 jours / 6 nuits",
    color: "#C1440E",
    bg: "from-orange-700 to-red-800",
    image: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
    highlights: ["✈️ Vol Royal Air Maroc", "🏨 BluSea Les Printemps 4★ Marrakech", "🏨 Hôtel Suisse Casablanca 4★", "🌙 Diner Gala désert Agafay"],
    departures: [
      { depart: "29/07/2026", retour: "04/08/2026" },
    ],
    description: "Marrakech envoûtante + Essaouira côtière + Casablanca moderne — Médinas, souks colorés et diner gala dans le désert.",
  },
  {
    id: "istanbul-aout",
    flag: "🇹🇷",
    destination: "Turquie",
    title: "Istanbul Août 2026",
    duree: "7 jours / 6 nuits",
    color: "#C0392B",
    bg: "from-red-700 to-slate-900",
    image: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Hôtel Istanbul", "🌉 Rive asiatique & Camlica", "🛍️ Olivium Outlet Mall"],
    departures: [
      { depart: "31/07/2026", retour: "06/08/2026" },
      { depart: "03/08/2026", retour: "09/08/2026" },
    ],
    description: "Istanbul entre deux rives — Quartier Uskudar, mosquée Camlica, panoramas sur le Bosphore et shopping au Olivium Outlet.",
  },
  {
    id: "riviera-turque",
    flag: "🇹🇷",
    destination: "Turquie",
    title: "La Riviera Turque 2026",
    duree: "8 jours / 7 nuits",
    color: "#1565C0",
    bg: "from-sky-700 to-blue-900",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    highlights: ["✈️ Vol Turkish Airlines", "🏨 Perdikia Hill 4★ Fethiye DP", "🏨 Hôtel Marmaris (All Inc ou LPD)", "🚙 Jeep Safari · Canyon Saklikent"],
    departures: [
      { depart: "13/08/2026", retour: "20/08/2026" },
    ],
    description: "Fethiye sauvage + Marmaris méditerranéenne — Jeep Safari, canyon Saklikent, cascades et eaux cristallines de la mer Égée.",
  },
]

function CTAButton({
  label,
  className,
  location,
  tripName = "",
}: {
  label: string
  className?: string
  location: string
  tripName?: string
}) {
  const msg = encodeURIComponent(
    tripName
      ? `Bonjour Easy2Book, je souhaite avoir des informations sur le voyage "${tripName}" ✈️\n\nMerci de me préciser :\n📅 Date de voyage souhaitée\n👥 Nombre de personnes\n👤 Âges des participants\n📞 Numéro de téléphone`
      : "Bonjour Easy2Book, je souhaite me renseigner sur vos voyages organisés 2026. ✈️\n\nMerci de me préciser :\n📅 Destination souhaitée\n📅 Date de voyage\n👥 Nombre de personnes\n👤 Âges des participants\n📞 Numéro de téléphone"
  )
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick(location, tripName)}
      className={className}
    >
      {label}
    </a>
  )
}

function VoyageCard({ voyage }: { voyage: typeof VOYAGES[0] }) {
  const [expanded, setExpanded] = useState(false)
  const visibleDeps = expanded ? voyage.departures : voyage.departures.slice(0, 3)

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col">
      <div className="relative h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={voyage.image}
          alt={voyage.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
          {voyage.flag} {voyage.destination}
        </div>
        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur border border-white/30 text-white text-xs font-semibold px-3 py-1 rounded-full">
          {voyage.duree}
        </div>
        <div className="absolute bottom-3 left-4">
          <h3 className="text-white font-black text-xl leading-tight">{voyage.title}</h3>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <p className="text-gray-500 text-sm mb-4 leading-relaxed">{voyage.description}</p>

        <div className="mb-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inclus</div>
          <div className="grid grid-cols-1 gap-1">
            {voyage.highlights.map((h, i) => (
              <div key={i} className="text-sm text-gray-700">{h}</div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            📅 Dates de départ ({voyage.departures.length} {voyage.departures.length > 1 ? "départs" : "départ"})
          </div>
          <div className="space-y-1">
            {visibleDeps.map((d, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm">
                <span className="font-semibold text-gray-800">🗓️ {d.depart}</span>
                <span className="text-gray-500">→ {d.retour}</span>
              </div>
            ))}
          </div>
          {voyage.departures.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              {expanded ? "▲ Voir moins" : `▼ +${voyage.departures.length - 3} autres départs`}
            </button>
          )}
        </div>

        <CTAButton
          label="💬 Réserver via WhatsApp"
          location={`card-${voyage.id}`}
          tripName={voyage.title}
          className="mt-auto block w-full bg-green-500 hover:bg-green-600 text-white font-black text-sm py-3 rounded-2xl text-center transition-all shadow hover:shadow-lg"
        />
      </div>
    </div>
  )
}

export default function VoyagesOrganisesPage() {
  useEffect(() => {
    const trackedDepths = new Set<string>()
    const handleScroll = () => {
      const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      const depth = pct >= 75 ? "75%" : pct >= 50 ? "50%" : pct >= 25 ? "25%" : null
      if (depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth)
        sendEvent("ScrollDepth", { depth, page: "voyages-organises" })
      }
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Easy2Book" width={44} height={44} className="rounded-full object-contain bg-white p-0.5" priority />
            <div>
              <div className="font-black text-gray-900 text-sm">Easy2Book</div>
              <div className="text-xs text-blue-600 font-semibold">Agence de Voyage</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`tel:+216${PHONE_NUMBER}`} className="hidden sm:flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-blue-700">
              📞 {PHONE_NUMBER}
            </a>
            <CTAButton
              label="💬 WhatsApp"
              location="header"
              className="bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-full transition-all shadow"
            />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1600&q=80"
            alt="Voyages organisés"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/80 via-blue-900/60 to-white/10" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center py-20">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/30 text-white text-sm font-bold px-5 py-2 rounded-full mb-6">
            🌍 Voyages Organisés Été & Automne 2026
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
            Partez avec
            <span className="text-yellow-400"> Easy2Book</span>
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
            Turquie · Malaisie & Bali · Égypte · Maroc<br />
            <span className="font-bold text-yellow-300">Voyages tout inclus · Devis gratuit · Assistance complète</span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mb-10">
            {[
              { icon: "✈️", text: "Vol inclus" },
              { icon: "🏨", text: "Hôtel sélectionné" },
              { icon: "🎯", text: "Visites guidées" },
              { icon: "👥", text: "Groupe organisé" },
            ].map((u, i) => (
              <div key={i} className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">{u.icon}</div>
                <div className="text-white text-xs font-bold">{u.text}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <CTAButton
              label="💬 Réserver sur WhatsApp"
              location="hero"
              className="bg-green-500 hover:bg-green-400 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-2xl transition-all hover:scale-105"
            />
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all"
            >
              📞 {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-blue-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { n: "8", label: "Destinations" },
              { n: "20+", label: "Dates de départ" },
              { n: "4★/5★", label: "Hôtels partenaires" },
              { n: "100%", label: "Organisé & guidé" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-3xl font-black text-yellow-400">{s.n}</div>
                <div className="text-white/80 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VOYAGES GRID */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700 mb-2">Été & Automne 2026</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Nos Voyages Organisés
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Sélectionnez votre destination et votre date de départ — contactez-nous sur WhatsApp pour un devis personnalisé
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {VOYAGES.map((v) => (
              <VoyageCard key={v.id} voyage={v} />
            ))}
          </div>
        </div>
      </section>

      {/* POURQUOI ACTIVE TRAVEL */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Pourquoi choisir Easy2Book ?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🤝", title: "Réseau de partenaires", desc: "Hôtels, compagnies aériennes et guides sélectionnés pour vous garantir la meilleure expérience au meilleur prix." },
              { icon: "💰", title: "Prix négociés", desc: "Grâce aux voyages en groupe et à notre expertise du marché, nous proposons des tarifs très compétitifs." },
              { icon: "🎯", title: "Programme clé en main", desc: "Tout est inclus : vols, hôtels, transfers, visites guidées. Vous n'avez qu'à profiter." },
              { icon: "👨‍✈️", title: "Guides expérimentés", desc: "Cyrine & Nawel — chargées de voyage disponibles avant et pendant tout votre séjour." },
              { icon: "🔒", title: "Réservation sécurisée", desc: "50% à la confirmation, solde 30 jours avant le départ. Conditions d'annulation claires." },
              { icon: "📞", title: "Support local 24/7", desc: "Une équipe tunisienne à votre écoute : par téléphone, email ou WhatsApp à toute heure." },
            ].map((a, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-all border border-gray-100">
                <div className="text-4xl mb-3">{a.icon}</div>
                <div className="font-black text-gray-900 text-lg mb-2">{a.title}</div>
                <p className="text-gray-600 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT BOTTOM CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-900 to-blue-700 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-5xl mb-4">✈️</div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Prêt à voyager ?
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Contactez notre équipe maintenant pour réserver votre place ou obtenir un devis personnalisé.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <CTAButton
              label="💬 Réserver sur WhatsApp"
              location="bottom-cta"
              className="bg-green-500 hover:bg-green-400 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-105"
            />
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all"
            >
              📞 {PHONE_NUMBER}
            </a>
          </div>
          <div className="flex gap-6 justify-center text-sm text-blue-200 flex-wrap">
            <span>📞 {PHONE_NUMBER}</span>
            <span>fb.com/Easy2Bookplateforme</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-gray-500 py-8 text-center text-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/logo.png" alt="Easy2Book" width={32} height={32} className="rounded-full bg-white p-0.5" />
            <span className="text-white font-bold">Easy2Book</span>
            <span className="text-gray-600">— Agence de Voyage</span>
          </div>
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick("footer")} className="text-green-400 hover:text-green-300 font-semibold">
              💬 WhatsApp
            </a>
            <a href="https://www.facebook.com/Easy2Bookplateforme" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold">
              Facebook
            </a>
          </div>
          <p className="text-xs text-gray-600">© 2026 Easy2Book. Tous droits réservés.</p>
        </div>
      </footer>

      {/* FLOATING WHATSAPP */}
      <div className="fixed bottom-6 right-6 z-50">
        <CTAButton
          label="💬"
          location="floating"
          className="bg-green-500 hover:bg-green-400 text-white text-3xl w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 block text-center leading-[4rem]"
        />
      </div>
    </div>
  )
}
