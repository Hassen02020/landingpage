"use client"

import { useState, useEffect } from "react"
import { SkipLink } from "@/app/components/SkipLink"
import Image from "next/image"
import { SiteHeader } from "@/app/components/SiteHeader"
import { SiteFooter } from "@/app/components/SiteFooter"
import { LeadCaptureForm } from "../components/LeadCaptureForm"
import { PHONE_NUMBER, WHATSAPP_NUMBER } from "@/lib/config"
import { handleWhatsAppClick, trackEvent as sendEvent } from "@/lib/tracking"
import { waText } from "@/lib/wa-text"
import { VOYAGES, VOYAGE_CATEGORIES, type Voyage, type VoyageCategory } from "./data"

function trackWhatsAppClick(event: { currentTarget: HTMLAnchorElement }, location: string, tripName: string = "") {
  const voyage = VOYAGES.find((v) => v.title === tripName)
  handleWhatsAppClick(event, {
    product: "voyage",
    location,
    offer: tripName || undefined,
    niche: voyage ? voyage.destination : undefined,
  })
}

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
  const msg = encodeURIComponent(waText(
    tripName
      ? `Bonjour Easy2Book, je souhaite avoir des informations sur le voyage "${tripName}"\n\nMerci de me préciser :\n- Date de voyage souhaitée\n- Nombre de personnes\n- Âges des participants\n- Numéro de téléphone`
      : "Bonjour Easy2Book, je souhaite me renseigner sur vos voyages organisés 2026.\n\nMerci de me préciser :\n- Destination souhaitée\n- Date de voyage\n- Nombre de personnes\n- Âges des participants\n- Numéro de téléphone"
  ))
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => trackWhatsAppClick(e, location, tripName)}
      className={className}
    >
      {label}
    </a>
  )
}

const CATEGORY_STYLE: Record<VoyageCategory, { bg: string; label: string }> = {
  Premium: { bg: "from-indigo-800 to-purple-900", label: "Premium" },
  "Individuel garanti": { bg: "from-emerald-700 to-teal-900", label: "Individuel garanti" },
  Standard: { bg: "from-sky-700 to-blue-900", label: "Standard" },
}

const fmtDate = (iso: string) => iso.split("-").reverse().join("/")
const fmtPrice = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")
// date du jour en Tunisie (AAAA-MM-JJ) ; sert à ne plus afficher un départ passé
const tunisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date())
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

function VoyageCard({ voyage, today }: { voyage: Voyage; today: string | null }) {
  const style = CATEGORY_STYLE[voyage.category]
  const days = today ? daysBetween(today, voyage.departIso) : null
  return (
    <article className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col">
      <div className={`relative bg-gradient-to-br ${style.bg} p-5 text-white`}>
        <div className="flex items-start justify-between gap-2">
          <span className="bg-white/20 border border-white/30 text-xs font-bold px-3 py-1 rounded-full">{style.label}</span>
          <span className="bg-white/20 border border-white/30 text-xs font-semibold px-3 py-1 rounded-full">{voyage.duration}</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-white/80">📍 {voyage.destination}</p>
        <h3 className="mt-1 text-xl font-black leading-tight">{voyage.title}</h3>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <dl className="space-y-2 text-sm text-gray-700 mb-4">
          <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
            <dt className="font-semibold">🗓️ Premier départ</dt>
            <dd className="font-bold text-gray-900">{fmtDate(voyage.departIso)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3">
            <dt>🛂 Visa</dt>
            <dd className="font-semibold">{voyage.visa === "avec" ? "Avec visa" : "À confirmer"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3">
            <dt>📋 Programme</dt>
            <dd className="font-semibold">Détaillé sur demande</dd>
          </div>
        </dl>
        {days !== null && days <= 14 && (
          <p className="mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold px-3 py-2 text-center text-sm">
            {days <= 0 ? "Départ aujourd'hui — contactez-nous vite" : `Départ dans ${days} jour${days > 1 ? "s" : ""}`}
          </p>
        )}

        <div className="mt-auto">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">À partir de</p>
          <p className="text-2xl font-black text-gray-900 mb-3">
            {fmtPrice(voyage.priceFrom)} <span className="text-base font-bold">TND</span> <span className="text-sm font-semibold text-gray-600">/ personne</span>
          </p>
          <CTAButton
            label="💬 Demander le programme"
            location={`card-${voyage.id}`}
            tripName={voyage.title}
            className="block w-full bg-green-700 hover:bg-green-800 text-white font-black text-sm py-3 rounded-2xl text-center transition-all shadow hover:shadow-lg"
          />
        </div>
      </div>
    </article>
  )
}

export default function VoyagesClient({ initialToday }: { initialToday: string }) {
  // la date du jour vient du serveur (page régénérée toutes les heures) : le HTML ne contient jamais de départ passé ;
  // le navigateur la remet à jour après l'affichage (même valeur au premier rendu : aucun écart d'hydratation)
  const [today, setToday] = useState<string | null>(initialToday)
  const [cat, setCat] = useState<"Tous" | VoyageCategory>("Tous")
  useEffect(() => setToday(tunisToday()), [])
  const upcoming = VOYAGES.filter((v) => !today || v.departIso >= today).sort((a, b) => a.departIso.localeCompare(b.departIso))
  const shown = upcoming.filter((v) => cat === "Tous" || v.category === cat)
  const cheapest = upcoming.length ? Math.min(...upcoming.map((v) => v.priceFrom)) : null
  const destinations = Array.from(new Set(upcoming.map((v) => v.destination))).slice(0, 6)
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
      <SkipLink label="Aller au contenu" />

      {/* HEADER */}
      <SiteHeader
        fixed
        current="/voyages-organises"
        cta={<CTAButton label="WhatsApp" location="header" className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm sm:text-base font-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shrink-0 transition-colors shadow" />}
      />
      <main id="contenu" tabIndex={-1} className="outline-none">

      {/* HERO */}
      <section className="relative min-h-[85vh] flex items-center justify-center pt-28 overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1000&q=72"
            srcSet="https://images.unsplash.com/photo-1527838832700-5059252407fa?w=640&q=72 640w, https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1000&q=72 1000w, https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1400&q=70 1400w"
            sizes="100vw"
            alt="Voyages organisés"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/45 via-blue-900/25 to-transparent" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center py-20 [text-shadow:0_2px_14px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/30 text-white text-sm font-bold px-5 py-2 rounded-full mb-6">
            🌍 Voyages organisés — départs de novembre 2026 à mai 2027
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
            Partez avec
            <span className="text-yellow-400"> Easy2Book</span>
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
            {destinations.join(" · ")}<br />
            <span className="font-bold text-yellow-300">Devis gratuit · Programme détaillé sur WhatsApp · Assistance complète</span>
          </p>

          {/* Filtre par catégorie */}
          <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-4 mb-10 max-w-xl mx-auto">
            <div className="text-white font-bold mb-3 text-center" id="filtre-categorie">Choisissez une catégorie</div>
            <div className="flex gap-2 flex-wrap justify-center" role="group" aria-labelledby="filtre-categorie">
              {(["Tous", ...VOYAGE_CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => {
                    setCat(c)
                    document.getElementById("voyages-grid")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className={`border border-white/40 text-sm font-bold px-4 py-2 rounded-full transition-all ${cat === c ? "bg-white text-blue-900" : "bg-white/20 hover:bg-white/30 text-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-blue-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { n: String(new Set(upcoming.map((v) => v.destination)).size), label: "Destinations" },
              { n: String(upcoming.length), label: "Départs à venir" },
              { n: String(VOYAGE_CATEGORIES.length), label: "Catégories de voyages" },
              { n: cheapest !== null ? `${fmtPrice(cheapest)} TND` : "—", label: "Prix à partir de / pers." },
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
      <section id="voyages-grid" className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700 mb-2">Départs de novembre 2026 à mai 2027</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Nos Voyages Organisés
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Prix « à partir de » par personne. Programme détaillé et devis personnalisé sur WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {shown.map((v) => (
              <VoyageCard key={v.id} voyage={v} today={today} />
            ))}
          </div>
          {shown.length === 0 && (
            <p className="text-center text-gray-600 py-10">
              Aucun départ dans cette catégorie pour le moment. Écrivez-nous sur WhatsApp : nous vous proposons les prochains départs.
            </p>
          )}
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
              { icon: "🎯", title: "Programme détaillé", desc: "Le programme et les prestations de chaque départ vous sont envoyés sur WhatsApp avant votre décision." },
              { icon: "👨‍✈️", title: "Guides expérimentés", desc: "Cyrine & Nawel — chargées de voyage disponibles avant et pendant tout votre séjour." },
              { icon: "🔒", title: "Réservation sécurisée", desc: "50% à la confirmation, solde 30 jours avant le départ. Conditions d'annulation claires." },
              { icon: "📞", title: "Équipe locale", desc: "Une équipe tunisienne à votre écoute par téléphone ou sur WhatsApp." },
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

      {/* LEAD FORM */}
      <section id="reservation" className="py-16 bg-gray-50">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">📝 Demandez votre devis</h2>
            <p className="text-gray-600">Laissez vos coordonnées, un conseiller vous recontacte pour confirmer places et tarifs.</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <LeadCaptureForm
              product="voyage"
              formId="voyage-lead-form"
              offers={VOYAGES.map((v) => v.title)}
            />
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
              className="bg-green-700 hover:bg-green-800 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-105"
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
      </main>

      <SiteFooter whatsappHref={`https://wa.me/${WHATSAPP_NUMBER}`} onWhatsApp={(e) => trackWhatsAppClick(e, "footer")} />

      {/* FLOATING WHATSAPP */}
      <aside aria-label="Contact WhatsApp" className="fixed bottom-6 right-6 z-50">
        <CTAButton
          label="💬"
          location="floating"
          className="bg-green-700 hover:bg-green-800 text-white text-3xl w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 block text-center leading-[4rem]"
        />
      </aside>
    </div>
  )
}
