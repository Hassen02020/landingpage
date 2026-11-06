"use client"

import { useState } from "react"
import { LeadCaptureForm } from "@/app/components/LeadCaptureForm"
import { PHONE_NUMBER, WHATSAPP_NUMBER } from "@/lib/config"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"
import { arDate } from "@/lib/dates-ar"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { waText } from "@/lib/wa-text"

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
const frDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${d} ${months[m - 1]} ${y}`
}

const T = {
  fr: { from: "À partir de", perPerson: "/ pers.", nights: "nuits", reserve: "Réserver cette offre", ask: "Question sur WhatsApp", full: "Complet", left: (n: number) => `Plus que ${n} place${n > 1 ? "s" : ""}`, formTitle: "Réservez votre place", formSub: "Moins d'une minute — un conseiller vous rappelle", included: "Inclus", call: "Appeler" },
  ar: { from: "ابتداءً من", perPerson: "/ للشخص", nights: "ليلة", reserve: "احجز هذا العرض", ask: "اسأل على واتساب", full: "مكتمل", left: (n: number) => `بقي ${n} أماكن فقط`, formTitle: "احجز مكانك الآن", formSub: "أقل من دقيقة — مستشارنا يتصل بيك", included: "يشمل", call: "اتصل" },
}

export function CategoryView({ category, offers }: { category: Category; offers: PublicOffer[] }) {
  const lang = category.lang
  const t = T[lang]
  const dir = lang === "ar" ? "rtl" : "ltr"
  const [offer, setOffer] = useState("")
  const label = (o: PublicOffer) => (o.departure_date ? `${o.name} — ${lang === "ar" ? arDate(o.departure_date).full : frDate(o.departure_date)}` : o.name)
  const left = (o: PublicOffer) => (o.seats_total === null ? null : Math.max(0, o.seats_total - o.seats_sold))
  const from = offers.length ? Math.min(...offers.map((o) => Number(o.price))) : null

  const choose = (o: PublicOffer) => {
    setOffer(label(o))
    trackEvent("ViewContent", { product: category.product, niche: category.slug, content_name: label(o), content_ids: o.id, value: Number(o.price), currency: "TND" })
    document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth" })
  }
  const wa = (o?: PublicOffer) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText(o ? `Bonjour Easy2Book, je suis intéressé(e) par : ${label(o)} (${o.price} TND).` : `Bonjour Easy2Book, je souhaite des informations sur : ${category.name}.`))}`

  return (
    <div className="min-h-screen bg-stone-50 text-gray-900 pb-20 sm:pb-0" dir={dir}>
      <header className="relative">
        {category.banner_desktop || category.banner_mobile ? (
          <picture>
            {category.banner_mobile && <source media="(max-width: 640px)" srcSet={category.banner_mobile} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={category.banner_desktop || category.banner_mobile!} alt={category.name} className="w-full h-64 sm:h-80 object-cover" />
          </picture>
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-emerald-800 to-emerald-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10 flex items-end">
          <div className="max-w-5xl mx-auto w-full px-4 pb-6 text-white">
            <h1 className="text-3xl sm:text-4xl font-black">{category.name}</h1>
            {category.headline && <p className="mt-1 text-white/90">{category.headline}</p>}
            {from !== null && (
              <p className="mt-2 font-bold text-amber-300">
                {t.from} <span dir="ltr">{fmt(from)}</span> TND {t.perPerson}
              </p>
            )}
          </div>
        </div>
      </header>

      {category.description && <p className="max-w-3xl mx-auto px-4 py-6 text-gray-700 whitespace-pre-line">{category.description}</p>}

      <section className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {offers.map((o) => {
          const n = left(o)
          return (
            <article key={o.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.image_url && <img src={o.image_url} alt={o.name} className="w-full h-44 object-cover" loading="lazy" />}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-lg font-black">{o.name}</h2>
                  {o.tag && <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full whitespace-nowrap">{o.tag}</span>}
                </div>
                <div className="text-sm text-gray-600 space-y-0.5 mb-3">
                  {o.destination && <div>📍 {o.destination}</div>}
                  {o.departure_date && <div>🗓️ {lang === "ar" ? arDate(o.departure_date).full : frDate(o.departure_date)}</div>}
                  {o.nights !== null && <div>🛏️ {o.nights} {t.nights}{o.nights_detail ? ` — ${o.nights_detail}` : ""}</div>}
                </div>
                {o.features.length > 0 && (
                  <ul className="text-sm text-gray-700 space-y-1 mb-3">
                    {o.features.slice(0, 6).map((f) => <li key={f}>✓ {f}</li>)}
                  </ul>
                )}
                <div className="mt-auto">
                  {o.price_before !== null && Number(o.price_before) > Number(o.price) && (
                    <div className="text-sm text-gray-400 line-through" dir="ltr">{fmt(Number(o.price_before))} TND</div>
                  )}
                  <div className="text-3xl font-black text-emerald-800"><span dir="ltr">{fmt(Number(o.price))}</span> <span className="text-base">TND</span></div>
                  {n !== null && n > 0 && n <= 10 && <p className="text-sm font-bold text-red-600 mt-1">🔥 {t.left(n)}</p>}
                  {n === 0 ? (
                    <div className="mt-3 text-center bg-gray-200 text-gray-600 font-black py-3 rounded-2xl">{t.full}</div>
                  ) : (
                    <button type="button" onClick={() => choose(o)} className="mt-3 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-2xl">
                      {t.reserve}
                    </button>
                  )}
                  <a
                    href={wa(o)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleWhatsAppClick(e, { product: category.product, location: `category-${category.slug}`, offer: label(o), niche: category.slug, value: Number(o.price) })}
                    className="mt-2 block text-center text-sm font-bold text-emerald-700 py-1"
                  >
                    💬 {t.ask}
                  </a>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section id="reservation" className="scroll-mt-4 py-10 bg-emerald-50">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-2xl font-black text-center mb-1">{t.formTitle}</h2>
          <p className="text-center text-gray-600 mb-5">{t.formSub}</p>
          <div className="bg-white rounded-3xl shadow-xl p-5">
            <LeadCaptureForm
              product={category.product}
              lang={lang}
              formId={`category-${category.slug}`}
              niche={category.slug}
              offers={offers.filter((o) => left(o) !== 0).map(label)}
              offerIds={Object.fromEntries(offers.map((o) => [label(o), o.id]))}
              offerValue={offer}
              onOfferChange={setOffer}
              showPromo
            />
          </div>
        </div>
      </section>

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t px-3 py-2 grid grid-cols-[1fr_auto_auto] gap-2">
        <a href="#reservation" className="bg-emerald-700 text-white font-black rounded-xl py-3 text-center">{t.reserve}</a>
        <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={(e) => handleWhatsAppClick(e, { product: category.product, location: "sticky", niche: category.slug })} className="bg-[#25D366] text-white font-bold rounded-xl px-4 py-3">WhatsApp</a>
        <a href={`tel:+216${PHONE_NUMBER}`} aria-label={t.call} className="border rounded-xl px-4 py-3">📞</a>
      </div>
    </div>
  )
}
