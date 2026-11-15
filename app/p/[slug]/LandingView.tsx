// RENDU PUBLIC DES PAGES DU CRÉATEUR (/p/<adresse>) : structure propre à chaque famille (Omra, Voyage, Hôtel, Offre). Les pages /c/<adresse> existantes
// gardent EXACTEMENT leur rendu historique (app/c/[slug]/CategoryView.tsx, inchangé) tant que l'inventaire de production n'est pas validé.
"use client"

import { Fragment, useState } from "react"
import { LeadCaptureForm } from "@/app/components/LeadCaptureForm"
import { PHONE_NUMBER, WHATSAPP_NUMBER } from "@/lib/config"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"
import { arDate } from "@/lib/dates-ar"
import type { Category, PublicOffer } from "@/lib/server/catalog"
import { waText } from "@/lib/wa-text"
import { familyOf } from "@/lib/page-builder/themes"
import { faqFor } from "@/lib/page-builder/faq"
import { SECTIONS, STYLE, derive, type FamilyStyle } from "@/lib/page-builder/style"
import { resolvePrimary, tint, visibleSections, type DesignSection, type PageDesign } from "@/lib/page-builder/design"
import { Countdown } from "./Countdown"
import { ReviewsSection } from "@/app/omra/ReviewsSection"
import Image from "next/image"
import Link from "next/link"
import { SiteHeader, formatPhone } from "@/app/components/SiteHeader"
import { SiteFooter } from "@/app/components/SiteFooter"
import { REVIEW_PAGE_KEYS } from "@/lib/review-pages"

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
const enDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  return `${months[m - 1]} ${d}, ${y}`
}
const frDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${d} ${months[m - 1]} ${y}`
}

const T = {
  fr: { from: "À partir de", perPerson: "/ pers.", nights: "nuits", reserve: "Réserver cette offre", ask: "Question sur WhatsApp", full: "Complet", left: (n: number) => `Plus que ${n} place${n > 1 ? "s" : ""}`, formTitle: "Réservez votre place", formSub: "Moins d'une minute — un conseiller vous rappelle", included: "Inclus", call: "Appeler", highlights: "Les points forts", includedTitle: "Prestations incluses", programme: "Programme", gallery: "En images", faq: "Questions fréquentes", dates: "Départs et prix", promo: "Promotion", testimonials: "Ils nous ont fait confiance", servicesTitle: "Ce qui est inclus", conditionsTitle: "Avantages et conditions", whatsappCta: "Écrire sur WhatsApp", preview: "Aperçu : les boutons et le formulaire sont désactivés." },
  en: { from: "From", perPerson: "/ person", nights: "nights", reserve: "Book this offer", ask: "Ask on WhatsApp", full: "Sold out", left: (n: number) => `Only ${n} place${n > 1 ? "s" : ""} left`, formTitle: "Book your place", formSub: "Less than a minute — an advisor calls you back", included: "Included", call: "Call", highlights: "Highlights", includedTitle: "What is included", programme: "Programme", gallery: "Gallery", faq: "Frequently asked questions", dates: "Departures and prices", promo: "Special offer", testimonials: "What our customers say", servicesTitle: "What the programme includes", conditionsTitle: "Benefits and conditions", whatsappCta: "Write on WhatsApp", preview: "Preview: buttons and form are disabled." },
  ar: { from: "ابتداءً من", perPerson: "/ للشخص", nights: "ليلة", reserve: "احجز هذا العرض", ask: "اسأل على واتساب", full: "مكتمل", left: (n: number) => `بقي ${n} أماكن فقط`, formTitle: "احجز مكانك الآن", formSub: "أقل من دقيقة — مستشارنا يتصل بيك", included: "يشمل", call: "اتصل", highlights: "أبرز المميزات", includedTitle: "الخدمات المشمولة", programme: "البرنامج", gallery: "صور", faq: "أسئلة شائعة", dates: "الرحلات والأسعار", promo: "عرض خاص", testimonials: "آراء عملائنا", servicesTitle: "ما يشمله البرنامج", conditionsTitle: "المزايا والشروط", whatsappCta: "راسلنا على واتساب", preview: "معاينة: الأزرار والنموذج معطّلة." },
}

// Style personnalisé : une SEULE couleur choisie (contraste du texte blanc vérifié à l'enregistrement) pilote boutons, titres, pastilles et bandeaux.
const CUSTOM: FamilyStyle = { page: "bg-gray-50", heroNoImage: "bg-[var(--p)]", accentText: "text-white", priceText: "text-[var(--p)]", button: "bg-[var(--p)] hover:brightness-90", buttonSoft: "text-[var(--p)]", chip: "bg-[var(--pl)] text-[var(--p)]", formBand: "bg-[var(--pl)]", sectionTitle: "text-[var(--p)]", ring: "ring-[var(--pl)]", accentColor: "#000000" }

// Libellés du menu de l'en-tête (liens d'ancrage vers les sections de la page)
const N = {
  fr: { video: "Vidéo", services: "Services", prices: "Départs et prix", reviews: "Avis", faq: "Questions", menu: "Menu" },
  en: { video: "Video", services: "Services", prices: "Departures & prices", reviews: "Reviews", faq: "FAQ", menu: "Menu" },
  ar: { video: "الفيديو الإعلاني", services: "تفاصيل البرنامج", prices: "الأسعار والحجز", reviews: "آراء الزوار", faq: "أسئلة شائعة", menu: "القائمة" },
} as const

// Icônes simples (trait) des cartes « services » de la mise en page « split » : avion, bouclier, hôtel, boussole
const ICONS = [
  "M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4s-1 0-3.5 3.5L7 6 5 8l6 3-3 3-3-.5L4 15l4 1 1 4 1.5-1-.5-3 3-3 3 6z",
  "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  "M4 21V5l8-2v18M12 7h8v14M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2M3 21h18",
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5 14 14l-5.5 1.5L10 10z",
]
const Icon = ({ i }: { i: number }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[i % ICONS.length]} /></svg>
)

export function LandingView({ category, offers, preview = false, design = null }: { category: Category; offers: PublicOffer[]; preview?: boolean; design?: PageDesign | null }) {
  const lang = category.lang
  const t = T[lang]
  const dir = lang === "ar" ? "rtl" : "ltr"
  const family = familyOf(category.product)
  const primary = design ? resolvePrimary(design) : null
  const base = STYLE[family]
  const st: FamilyStyle = primary ? { ...CUSTOM, accentColor: primary, page: design?.background === "blanc" ? "bg-white" : design?.background === "teinte" ? "bg-[var(--pl)]" : base.page } : { ...base, page: design?.background === "blanc" ? "bg-white" : base.page }
  const vars = primary ? ({ "--p": primary, "--pl": tint(primary) } as React.CSSProperties) : undefined
  const ctaLabel = design?.cta.label || t.reserve
  const showBefore = design ? design.price.showBefore : true
  const showFrom = design ? design.price.prefix : true
  const [offer, setOffer] = useState("")
  const label = (o: PublicOffer) => (o.departure_date ? `${o.name} — ${lang === "ar" ? arDate(o.departure_date).full : lang === "en" ? enDate(o.departure_date) : frDate(o.departure_date)}` : o.name)
  const left = (o: PublicOffer) => (o.seats_total === null ? null : Math.max(0, o.seats_total - o.seats_sold))
  const from = offers.length ? Math.min(...offers.map((o) => Number(o.price))) : null
  const info = derive(offers)
  if (design && design.program.length) info.programmes = design.program.map((x) => ({ name: x.title, text: x.text }))
  const hasPromo = offers.some((o) => o.price_before !== null && Number(o.price_before) > Number(o.price))
  const split = design?.hero === "split"
  const heroVideo = split ? design?.blocks.find((b) => b.type === "video") ?? null : null
  const reviewed = REVIEW_PAGE_KEYS.includes(category.slug) && lang === "ar"
  const priceByOffer = Object.fromEntries(offers.map((o) => [label(o), Number(o.price)]))
  const faq = design && design.faq.length ? design.faq : faqFor(family, lang)

  const choose = (o: PublicOffer) => {
    setOffer(label(o))
    if (!preview) trackEvent("ViewContent", { product: category.product, niche: category.slug, content_name: label(o), content_ids: o.id, value: Number(o.price), currency: "TND" })
    document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth" })
  }
  const wa = (o?: PublicOffer) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText(o ? `Bonjour Easy2Book, je suis intéressé(e) par : ${label(o)} (${o.price} TND).` : `Bonjour Easy2Book, je souhaite des informations sur : ${category.name}.`))}`
  const onWa = (extra: Record<string, unknown>) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (preview) { e.preventDefault(); return }
    handleWhatsAppClick(e, { product: category.product, niche: category.slug, ...extra } as Parameters<typeof handleWhatsAppClick>[1])
  }
  const title = (txt: string) => <h2 className={`text-2xl font-black mb-4 ${st.sectionTitle}`}>{txt}</h2>

  /** Bloc personnalisé : TEXTE BRUT échappé par React, images en https:// ou « /… » (validées à l'enregistrement ET à la lecture), aucune ressource tierce. */
  const block = (key: string) => {
    const b = design?.blocks.find((x) => `block:${x.id}` === key)
    if (!b) return null
    if (heroVideo && b.id === heroVideo.id) return null // déjà affichée dans l'en-tête
    const wrap = (children: React.ReactNode, narrow = false) => (
      <section key={key} id={`bloc-${b.id}`} className={`${narrow ? "max-w-3xl" : "max-w-5xl"} mx-auto px-4 py-6 scroll-mt-4`} aria-label={b.title} data-testid="block" data-block-type={b.type}>{children}</section>
    )
    switch (b.type) {
      case "text":
        return wrap(<>{title(b.title)}<p className="text-gray-700 whitespace-pre-line leading-relaxed">{b.text}</p></>, true)
      case "benefits":
        return wrap(<>{title(b.title)}<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{b.items.map((x, i) => (
          <div key={x.title + i} className="bg-white rounded-2xl border border-gray-100 p-5"><h3 className="font-black">✓ {x.title}</h3>{x.text && <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{x.text}</p>}</div>))}</div></>)
      case "steps":
        return wrap(<>{title(b.title)}<ol className="space-y-3">{b.items.map((x, i) => (
          <li key={x.title + i} className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4"><span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white ${st.button.split(" ")[0]}`} dir="ltr">{i + 1}</span><div><h3 className="font-black">{x.title}</h3>{x.text && <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{x.text}</p>}</div></li>))}</ol></>, true)
      case "gallery":
        return wrap(<>{title(b.title)}<div className="grid grid-cols-2 md:grid-cols-3 gap-3">{b.images.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={b.title} className="w-full h-40 sm:h-52 object-cover rounded-2xl" loading="lazy" />))}</div></>)
      case "image_text":
        return wrap(<div className="grid gap-5 md:grid-cols-2 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.images[0]} alt={b.title} className="w-full h-56 md:h-72 object-cover rounded-2xl" loading="lazy" />
          <div>{title(b.title)}<p className="text-gray-700 whitespace-pre-line leading-relaxed">{b.text}</p></div></div>)
      case "cta":
        return wrap(<div className={`rounded-3xl p-8 text-center ${st.formBand}`}>
          <h2 className={`text-2xl font-black ${st.sectionTitle}`}>{b.title}</h2>
          {b.text && <p className="mt-2 text-gray-700 whitespace-pre-line">{b.text}</p>}
          {b.cta === "whatsapp"
            ? <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: `block-${b.id}` })} className="mt-4 inline-block bg-[#0e7a3c] hover:bg-[#0b6a33] text-white font-black px-6 py-3 rounded-2xl">💬 {b.ctaLabel}</a>
            : <a href="#reservation" className={`mt-4 inline-block text-white font-black px-6 py-3 rounded-2xl ${st.button}`}>{b.ctaLabel}</a>}
        </div>, true)
      case "video":
        // fichier du site (chemin validé à l'enregistrement ET à la lecture), chargé à la demande : rien n'est téléchargé avant le clic
        return wrap(<>{title(b.title)}<figure>
          <video controls playsInline preload="none" poster={b.images[0]} className="w-full rounded-2xl bg-black" aria-label={b.title} data-testid="block-video">
            <source src={b.video} type={b.video.endsWith(".webm") ? "video/webm" : "video/mp4"} />
          </video>
          {b.text && <figcaption className="mt-2 text-sm text-gray-600 whitespace-pre-line">{b.text}</figcaption>}
        </figure></>)
      case "notice":
        return wrap(<div className={`rounded-2xl p-6 ${st.formBand}`}><p className={`text-xs font-black ${st.priceText}`}>{b.title}</p><p className="mt-1 font-bold text-gray-900 whitespace-pre-line">{b.text}</p></div>, true)
    }
  }

  const section = (key: DesignSection) => {
    if (key.startsWith("block:")) return block(key)
    switch (key) {
      case "intro":
        return category.description && !split ? <p key={key} className="max-w-3xl mx-auto px-4 py-6 text-gray-700 whitespace-pre-line leading-relaxed">{category.description}</p> : null
      case "highlights":
        return info.highlights.length >= 2 ? (
          <section key={key} className="max-w-5xl mx-auto px-4 pt-2 pb-4" aria-label={t.highlights}>
            <h2 className={`text-center text-sm font-black uppercase tracking-wide mb-3 ${st.sectionTitle}`}>{t.highlights}</h2>
            <ul className="flex flex-wrap gap-2 justify-center">{info.highlights.map((f) => <li key={f} className={`text-sm font-bold px-3 py-1.5 rounded-full ${st.chip}`}>✓ {f}</li>)}</ul>
          </section>
        ) : null
      case "offers":
        return (
          <section key={key} id="offres" className="max-w-6xl mx-auto px-4 py-6 scroll-mt-4">
            {offers.length > 1 && title(t.dates)}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {offers.map((o) => {
                const n = left(o)
                return (
                  <article key={o.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {o.image_url && <img src={o.image_url} alt={o.name} className="w-full h-44 object-cover" loading="lazy" />}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-black">{o.name}</h3>
                        {o.tag && <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${st.chip}`}>{o.tag}</span>}
                      </div>
                      <div className="text-sm text-gray-600 space-y-0.5 mb-3">
                        {o.destination && <div>📍 {o.destination}</div>}
                        {o.departure_date && <div>🗓️ {lang === "ar" ? arDate(o.departure_date).full : lang === "en" ? enDate(o.departure_date) : frDate(o.departure_date)}</div>}
                        {o.nights !== null && <div>🛏️ {o.nights} {t.nights}{o.nights_detail ? ` — ${o.nights_detail}` : ""}</div>}
                      </div>
                      {o.features.length > 0 && (
                        <ul className="text-sm text-gray-700 space-y-1 mb-3">{o.features.slice(0, 6).map((f) => <li key={f}>✓ {f}</li>)}</ul>
                      )}
                      <div className="mt-auto">
                        {showBefore && o.price_before !== null && Number(o.price_before) > Number(o.price) && <div className="text-sm text-gray-400 line-through" dir="ltr">{fmt(Number(o.price_before))} TND</div>}
                        <div className={`text-3xl font-black ${st.priceText}`}><span dir="ltr">{fmt(Number(o.price))}</span> <span className="text-base">TND</span></div>
                        {n !== null && n > 0 && n <= 10 && <p className="text-sm font-bold text-red-600 mt-1">🔥 {t.left(n)}</p>}
                        {n === 0 ? (
                          <div className="mt-3 text-center bg-gray-200 text-gray-600 font-black py-3 rounded-2xl">{t.full}</div>
                        ) : (
                          <button type="button" onClick={() => choose(o)} className={`mt-3 w-full text-white font-black py-3 rounded-2xl ${st.button}`}>{t.reserve}</button>
                        )}
                        <a href={wa(o)} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: `category-${category.slug}`, offer: label(o), value: Number(o.price) })} className={`mt-2 block text-center text-sm font-bold py-1 ${st.buttonSoft}`}>💬 {t.ask}</a>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      case "inclusions":
        return info.features.length > 0 ? (
          <section key={key} className="max-w-4xl mx-auto px-4 py-6" aria-label={t.includedTitle}>
            {title(t.includedTitle)}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">{info.features.map((f) => <li key={f} className="bg-white rounded-xl border border-gray-100 px-4 py-2">✓ {f}</li>)}</ul>
          </section>
        ) : null
      case "programme":
        return info.programmes.length > 0 ? (
          <section key={key} id="programme" className="max-w-4xl mx-auto px-4 py-6 scroll-mt-4">
            {title(t.programme)}
            <div className="space-y-3">
              {info.programmes.map((p, i) => (
                <details key={p.name + i} open={i === 0} className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
                  <summary className="font-black cursor-pointer">{p.name}</summary>
                  <p className="mt-2 text-gray-700 whitespace-pre-line leading-relaxed">{p.text}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null
      case "gallery":
        return info.images.length >= 2 ? (
          <section key={key} className="max-w-6xl mx-auto px-4 py-6" aria-label={t.gallery}>
            {title(t.gallery)}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {info.images.slice(0, 6).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={category.name} className="w-full h-40 sm:h-52 object-cover rounded-2xl" loading="lazy" />
              ))}
            </div>
          </section>
        ) : null
      case "services":
        return design && design.services.length > 0 ? (
          <section key={key} id="services" className="max-w-5xl mx-auto px-4 py-6" aria-label={t.servicesTitle} data-testid="services">
            {title(t.servicesTitle)}
            <div className={`grid grid-cols-1 gap-4 ${split ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}>
              {design.services.map((x, i) => (
                <div key={x.title + i} className={`rounded-2xl border p-6 ${split ? "bg-[#fbf8f2] border-[#efe7d6]" : "bg-white border-gray-100"}`}>
                  {split ? <span className={`block ${st.priceText}`}><Icon i={i} /></span> : <p className={`text-xs font-black ${st.priceText}`} dir="ltr">{String(i + 1).padStart(2, "0")}</p>}
                  <h3 className="mt-1 text-lg font-black">{x.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{x.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null
      case "conditions":
        return design && design.conditions.length > 0 ? (
          <section key={key} id="conditions" className="max-w-5xl mx-auto px-4 py-6" aria-label={t.conditionsTitle} data-testid="conditions">
            <div className={`rounded-2xl p-6 grid gap-5 ${design.conditions.length === 1 ? "md:grid-cols-1" : design.conditions.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} ${st.formBand}`}>
              {design.conditions.map((x, i) => (
                <div key={x.title + i}>
                  <p className={`text-xs font-black ${st.priceText}`}>{x.title}</p>
                  <p className="mt-1 text-sm font-bold text-gray-900 whitespace-pre-line">{x.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null
      case "testimonials":
        return design && design.testimonials.length > 0 ? (
          <section key={key} className="max-w-5xl mx-auto px-4 py-6" aria-label={t.testimonials} data-testid="testimonials">
            {title(t.testimonials)}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {design.testimonials.map((x, i) => (
                <figure key={x.name + i} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <blockquote className="text-gray-700 whitespace-pre-line">« {x.text} »</blockquote>
                  <figcaption className="mt-3 text-sm font-bold">{x.name}{x.place ? <span className="font-normal text-gray-500"> — {x.place}</span> : null}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null
      case "faq":
        return (
          <section key={key} id="faq" className="max-w-3xl mx-auto px-4 py-6 scroll-mt-4">
            {title(t.faq)}
            <div className="space-y-2">
              {faq.map((f) => (
                <details key={f.q} className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
                  <summary className="font-bold cursor-pointer">{f.q}</summary>
                  <p className="mt-2 text-gray-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )
      case "form":
        return (
          <Fragment key={key}>
          {reviewed && <ReviewsSection page={category.slug} />}
          <section id="reservation" className={`scroll-mt-4 py-10 ${st.formBand}`}>
            <div className="max-w-xl mx-auto px-4">
              <h2 className="text-2xl font-black text-center mb-1">{t.formTitle}</h2>
              <p className="text-center text-gray-600 mb-5">{t.formSub}</p>
              <div className="bg-white rounded-3xl shadow-xl p-5">
                <fieldset disabled={preview} className="border-0 p-0 m-0 min-w-0">
                  <LeadCaptureForm
                    product={category.product}
                    lang={lang}
                    accentColor={st.accentColor}
                    formId={`category-${category.slug}`}
                    niche={category.slug}
                    offers={offers.filter((o) => left(o) !== 0).map(label)}
                    offerIds={Object.fromEntries(offers.map((o) => [label(o), o.id]))}
                    offerValue={offer}
                    onOfferChange={setOffer}
                    showPromo
                    askEmail={design?.form.email === true}
                    askTravelers={family === "voyage" || family === "hotel" || family === "omra"}
                    priceByOffer={split ? priceByOffer : undefined}
                  />
                </fieldset>
              </div>
            </div>
          </section>
          </Fragment>
        )
    }
  }

  return (
    <div className={`min-h-screen ${st.page} text-gray-900 pb-20 sm:pb-0`} dir={dir} lang={lang} data-page-lang={lang} data-family={family} style={vars} data-custom-colors={primary ? "yes" : undefined}>
      {!preview && split && (
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100" data-testid="brochure-header">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <Image src="/logo.png" alt="" width={44} height={44} priority className="w-11 h-11 object-contain" />
              <span className="leading-tight min-w-0">
                <span className="block font-black text-gray-900 text-base">Easy2Book</span>
                <span className="block text-[11px] font-bold text-amber-700 truncate max-w-[10rem] sm:max-w-xs">{category.name}</span>
              </span>
            </Link>
            <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6 text-sm font-semibold text-gray-700">
              {heroVideo && <a href="#video" className="hover:text-gray-900">{N[lang].video}</a>}
              {design && design.services.length > 0 && <a href="#services" className="hover:text-gray-900">{N[lang].services}</a>}
              <a href="#offres" className="hover:text-gray-900">{N[lang].prices}</a>
              {reviewed && <a href="#avis" className="hover:text-gray-900">{N[lang].reviews}</a>}
              <a href="#faq" className="hover:text-gray-900">{N[lang].faq}</a>
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "header" })} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-900" aria-label="WhatsApp">
                <span dir="ltr">{formatPhone(PHONE_NUMBER)}</span><span aria-hidden="true">💬</span>
              </a>
              <a href="#reservation" className={`text-white text-sm font-bold px-4 py-2.5 rounded-lg ${st.button}`}>{ctaLabel}</a>
            </div>
          </div>
        </header>
      )}
      {!preview && !split && (
        <SiteHeader
          nav={[
            ...(design && design.services.length > 0 ? [{ href: "#services", label: N[lang].services }] : []),
            { href: "#offres", label: N[lang].prices },
            ...(reviewed ? [{ href: "#avis", label: N[lang].reviews }] : []),
            { href: "#faq", label: N[lang].faq },
          ]}
          tagline={lang === "ar" ? category.name : "Centrale de réservation"}
          taglineOnMobile={lang === "ar"}
          phoneAriaLabel={t.call}
          menuLabel={N[lang].menu}
          cta={<a href="#reservation" className={`text-white text-sm sm:text-base font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shrink-0 ${st.button}`}>{ctaLabel}</a>}
        />
      )}
      {preview && <div className="bg-amber-100 text-amber-900 text-sm font-bold text-center py-2 px-3" role="status">{t.preview}</div>}
      {design?.deadline ? <Countdown deadline={design.deadline} lang={lang} /> : null}
      {split ? (
        <header className="bg-[#fbf8f2] border-b border-[#efe7d6]" data-testid="hero-split">
          <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 grid gap-8 lg:grid-cols-2 items-center">
            <div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">{category.name}</span>
              {(() => {
                const h = category.headline || category.name
                const cut = h.search(/…|\.\.\./)
                return (
                  <h1 className="mt-4 text-3xl sm:text-5xl font-black leading-tight text-gray-900">
                    {cut > 0 ? <>{h.slice(0, cut).trim()}… <span className="text-amber-600">{h.slice(cut).replace(/^(…|\.\.\.)\s*/, "")}</span></> : h}
                  </h1>
                )
              })()}
              {category.description && <p className="mt-4 text-gray-600 leading-relaxed whitespace-pre-line">{category.description}</p>}
              {showFrom && from !== null && (
                <p className="mt-3 font-black text-lg text-gray-900">{t.from} <span dir="ltr">{fmt(from)}</span> TND {t.perPerson}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#reservation" className={`inline-block text-white font-black px-6 py-3 rounded-2xl ${st.button}`}>{ctaLabel}</a>
                {design?.cta.whatsapp && <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "hero" })} className="inline-block bg-[#0e7a3c] hover:bg-[#0b6a33] text-white font-black px-6 py-3 rounded-2xl">💬 {t.whatsappCta}</a>}
              </div>
            </div>
            {heroVideo && (
              <figure id="video" className="mx-auto w-full max-w-[300px] scroll-mt-20">
                <video controls playsInline preload="none" poster={heroVideo.images[0]} className="w-full aspect-[9/16] rounded-3xl bg-black object-cover shadow-2xl" aria-label={heroVideo.title} data-testid="block-video">
                  <source src={heroVideo.video} type={heroVideo.video.endsWith(".webm") ? "video/webm" : "video/mp4"} />
                </video>
              </figure>
            )}
          </div>
        </header>
      ) : (
      <header className="relative">
        {category.banner_desktop || category.banner_mobile ? (
          <picture>
            {category.banner_mobile && <source media="(max-width: 640px)" srcSet={category.banner_mobile} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={category.banner_desktop || category.banner_mobile!} alt={category.name} className="w-full h-64 sm:h-80 object-cover" />
          </picture>
        ) : (
          <div className={`w-full h-56 sm:h-64 ${st.heroNoImage}`} />
        )}
        <div className={`absolute inset-0 flex items-end ${category.banner_desktop || category.banner_mobile ? "bg-gradient-to-t from-black/60 to-transparent" : "bg-gradient-to-t from-black/25 to-transparent"}`}>
          <div className="max-w-5xl mx-auto w-full px-4 pb-6 text-white">
            {family === "autre" && hasPromo && <span className="inline-block mb-2 text-xs font-black bg-amber-300 text-amber-950 px-3 py-1 rounded-full">{t.promo}</span>}
            <h1 className="text-3xl sm:text-4xl font-black">{category.name}</h1>
            {category.headline && <p className="mt-1 text-white/90">{category.headline}</p>}
            {showFrom && from !== null && (
              <p className={`mt-2 font-bold ${st.accentText}`}>
                {t.from} <span dir="ltr">{fmt(from)}</span> TND {t.perPerson}
              </p>
            )}
            <div className="mt-4 hidden sm:flex flex-wrap gap-3">
              <a href="#reservation" className={`inline-block text-white font-black px-6 py-3 rounded-2xl ${st.button}`}>{ctaLabel}</a>
              {design?.cta.whatsapp && <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "hero" })} className="inline-block bg-[#0e7a3c] hover:bg-[#0b6a33] text-white font-black px-6 py-3 rounded-2xl">💬 {t.whatsappCta}</a>}
            </div>
          </div>
        </div>
      </header>
      )}

      {(design ? visibleSections(design) : (SECTIONS[family] as DesignSection[])).map((k) => section(k))}

      {!preview && split && (
        <footer className="bg-[#fbf8f2] border-t border-[#efe7d6]" data-testid="brochure-footer">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Easy2Book, centrale de réservation" width={44} height={44} className="w-11 h-11 object-contain" />
              <span className="leading-tight">
                <span className="block font-black text-gray-900">Easy2Book · Centrale de Réservation</span>
                <span className="block text-xs text-gray-500">{category.name}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold">
              <a href={`tel:+216${PHONE_NUMBER}`} className="text-gray-800" dir="ltr">📞 {formatPhone(PHONE_NUMBER)}</a>
              <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "footer" })} className="text-emerald-800">WhatsApp</a>
              <span dir="ltr">www.easy2book.tn</span>
              <Link href="/mentions-legales" className="text-xs font-normal underline">Mentions légales</Link>
            </div>
          </div>
        </footer>
      )}
      {!preview && !split && <SiteFooter whatsappHref={wa()} onWhatsApp={onWa({ location: "footer" })} />}

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t px-3 py-2 grid grid-cols-[1fr_auto_auto] gap-2">
        <a href="#reservation" className={`text-white font-black rounded-xl py-3 text-center ${st.button}`}>{ctaLabel}</a>
        <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "sticky" })} className="bg-[#0e7a3c] hover:bg-[#0b6a33] text-white font-black rounded-xl px-4 py-3" aria-label="WhatsApp">💬</a>
        <a href={`tel:+216${PHONE_NUMBER}`} aria-label={t.call} className="border rounded-xl px-4 py-3">📞</a>
      </div>
    </div>
  )
}
