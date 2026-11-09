"use client"

import Image from "next/image"
import { SkipLink } from "@/app/components/SkipLink"
import { SiteHeader, WhatsAppIcon } from "@/app/components/SiteHeader"
import { SiteFooter } from "@/app/components/SiteFooter"
import Link from "next/link"
import { waText } from "@/lib/wa-text"
import { LeadCaptureForm } from "./components/LeadCaptureForm"
import { PHONE_NUMBER, WHATSAPP_NUMBER, type Product } from "@/lib/config"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"

// Page d'accueil des campagnes : présente en bref les 3 offres Easy2Book
// et oriente le visiteur vers la landing page détaillée ou le formulaire.

const OFFERS: {
  product: Product
  href: string
  emoji: string
  title: string
  subtitle: string
  price: string
  points: string[]
  image?: string
  color: string
}[] = [
  {
    product: "voyage",
    href: "/voyages-organises",
    emoji: "✈️",
    title: "Voyages organisés",
    subtitle: "Australie · Japon · Égypte · Jordanie · Turquie · Maroc",
    price: "Vols + hôtels + visites inclus",
    points: ["Départs garantis depuis Tunis", "Accompagnateur Easy2Book", "Paiement facilité"],
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80",
    color: "from-blue-700 to-blue-900",
  },
  {
    product: "omra",
    href: "/omra",
    emoji: "🕋",
    title: "Omra Ramadan & Chawwal 2027",
    subtitle: "14 nuits · Makkah & Médine",
    price: "Ramadan dès 5 500 TND · Chawwal dès 4 800 TND",
    points: ["Visa + assurance + vol inclus", "Hôtel 3★ proche du Haram", "Accompagnatrice femme"],
    color: "from-emerald-700 to-emerald-900",
  },
  {
    product: "hotel",
    href: "/summer-vibes",
    emoji: "🏖️",
    title: "Promos hôtels Tunisie",
    subtitle: "Hammamet · Sousse · Djerba · Monastir",
    price: "Early booking jusqu'à -40%",
    points: ["Enfant gratuit", "Aquapark & All inclusive", "Voyage de noces"],
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
    color: "from-amber-600 to-orange-700",
  },
]

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText(
  "Bonjour Easy2Book, je souhaite des informations sur vos offres (voyages organisés / Omra / hôtels)."
))}`

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <SkipLink label="Aller au contenu" />
      {/* HEADER */}
      <SiteHeader
        cta={
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => handleWhatsAppClick(e, { product: "autre", location: "home-header" })}
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-black px-4 sm:px-5 py-2.5 rounded-full shrink-0 shadow transition-colors"
          >
            <WhatsAppIcon /> WhatsApp
          </a>
        }
      />
      <main id="contenu" tabIndex={-1} className="outline-none">

      {/* HERO */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20 text-center">
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-4">
            Voyages organisés, Omra & <span className="text-amber-400">promos hôtels</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8">
            Choisissez votre offre, recevez votre devis gratuit sur WhatsApp. Réservation simple, avec un conseiller Easy2Book.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#devis"
              className="bg-amber-400 hover:bg-amber-300 text-black font-black text-lg px-8 py-4 rounded-2xl shadow-xl"
            >
              📝 Demander un devis
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleWhatsAppClick(e, { product: "autre", location: "home-hero" })}
              className="bg-green-700 hover:bg-green-800 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl"
            >
              💬 Écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* OFFRES */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-10">Nos offres en ce moment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {OFFERS.map((o) => (
              <Link
                key={o.product}
                href={o.href}
                onClick={() =>
                  trackEvent("ViewContent", {
                    product: o.product,
                    content_category: o.product,
                    content_name: o.title,
                    content_ids: o.product,
                  })
                }
                className="group bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 flex flex-col"
              >
                <div className="relative h-52 overflow-hidden">
                  {o.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.image}
                      alt={o.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-7xl bg-emerald-900">{o.emoji}</div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t ${o.color} opacity-30`} />
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/75 via-black/35 to-transparent" aria-hidden="true" />
                  <div className="absolute bottom-3 left-4 right-4 text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
                    <div className="text-2xl font-black">
                      {o.emoji} {o.title}
                    </div>
                    <div className="text-sm text-white/90">{o.subtitle}</div>
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="text-emerald-700 font-black mb-3">{o.price}</div>
                  <ul className="space-y-1 text-sm text-gray-700 mb-5 flex-1">
                    {o.points.map((p) => (
                      <li key={p}>✓ {p}</li>
                    ))}
                  </ul>
                  <span className="block text-center bg-gray-900 group-hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition-colors">
                    Voir l&apos;offre →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FORMULAIRE */}
      <section id="devis" className="py-14">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-black mb-2">📝 Votre devis gratuit</h2>
            <p className="text-gray-600">Un conseiller Easy2Book vous recontacte rapidement sur WhatsApp.</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
            <LeadCaptureForm formId="home-lead-form" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      </main>

      <SiteFooter whatsappHref={WHATSAPP_URL} onWhatsApp={(e) => handleWhatsAppClick(e, { product: "autre", location: "home-footer" })} />

      {/* WHATSAPP FLOTTANT */}
      <aside aria-label="Contact WhatsApp">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleWhatsAppClick(e, { product: "autre", location: "home-floating" })}
        aria-label="WhatsApp"
        className="fixed bottom-6 right-6 z-50 bg-green-700 hover:bg-green-800 text-white text-3xl w-16 h-16 rounded-full shadow-2xl flex items-center justify-center"
      >
        💬
      </a>
      </aside>
    </div>
  )
}
