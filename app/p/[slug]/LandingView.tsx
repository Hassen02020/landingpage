// RENDU PUBLIC DES PAGES DU CRÉATEUR (/p/<adresse>) : structure propre à chaque famille (Omra, Voyage, Hôtel, Offre). Les pages /c/<adresse> existantes
// gardent EXACTEMENT leur rendu historique (app/c/[slug]/CategoryView.tsx, inchangé) tant que l'inventaire de production n'est pas validé.
"use client"

import { useState } from "react"
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

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
const frDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${d} ${months[m - 1]} ${y}`
}

const T = {
  fr: { from: "À partir de", perPerson: "/ pers.", nights: "nuits", reserve: "Réserver cette offre", ask: "Question sur WhatsApp", full: "Complet", left: (n: number) => `Plus que ${n} place${n > 1 ? "s" : ""}`, formTitle: "Réservez votre place", formSub: "Moins d'une minute — un conseiller vous rappelle", included: "Inclus", call: "Appeler", highlights: "Les points forts", includedTitle: "Prestations incluses", programme: "Programme", gallery: "En images", faq: "Questions fréquentes", dates: "Départs et prix", promo: "Promotion", testimonials: "Ils nous ont fait confiance", whatsappCta: "Écrire sur WhatsApp", preview: "Aperçu : les boutons et le formulaire sont désactivés." },
  ar: { from: "ابتداءً من", perPerson: "/ للشخص", nights: "ليلة", reserve: "احجز هذا العرض", ask: "اسأل على واتساب", full: "مكتمل", left: (n: number) => `بقي ${n} أماكن فقط`, formTitle: "احجز مكانك الآن", formSub: "أقل من دقيقة — مستشارنا يتصل بيك", included: "يشمل", call: "اتصل", highlights: "أبرز المميزات", includedTitle: "الخدمات المشمولة", programme: "البرنامج", gallery: "صور", faq: "أسئلة شائعة", dates: "الرحلات والأسعار", promo: "عرض خاص", testimonials: "آراء عملائنا", whatsappCta: "راسلنا على واتساب", preview: "معاينة: الأزرار والنموذج معطّلة." },
}

// Style personnalisé : une SEULE couleur choisie (contraste du texte blanc vérifié à l'enregistrement) pilote boutons, titres, pastilles et bandeaux.
const CUSTOM: FamilyStyle = { page: "bg-gray-50", heroNoImage: "bg-[var(--p)]", accentText: "text-white", priceText: "text-[var(--p)]", button: "bg-[var(--p)] hover:brightness-90", buttonSoft: "text-[var(--p)]", chip: "bg-[var(--pl)] text-[var(--p)]", formBand: "bg-[var(--pl)]", sectionTitle: "text-[var(--p)]", ring: "ring-[var(--pl)]", accentColor: "#000000" }

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
  const label = (o: PublicOffer) => (o.departure_date ? `${o.name} — ${lang === "ar" ? arDate(o.departure_date).full : frDate(o.departure_date)}` : o.name)
  const left = (o: PublicOffer) => (o.seats_total === null ? null : Math.max(0, o.seats_total - o.seats_sold))
  const from = offers.length ? Math.min(...offers.map((o) => Number(o.price))) : null
  const info = derive(offers)
  if (design && design.program.length) info.programmes = design.program.map((x) => ({ name: x.title, text: x.text }))
  const hasPromo = offers.some((o) => o.price_before !== null && Number(o.price_before) > Number(o.price))
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

  const section = (key: DesignSection) => {
    switch (key) {
      case "intro":
        return category.description ? <p key={key} className="max-w-3xl mx-auto px-4 py-6 text-gray-700 whitespace-pre-line leading-relaxed">{category.description}</p> : null
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
                        {o.departure_date && <div>🗓️ {lang === "ar" ? arDate(o.departure_date).full : frDate(o.departure_date)}</div>}
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
          <section key={key} id="reservation" className={`scroll-mt-4 py-10 ${st.formBand}`}>
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
                    askTravelers={family === "voyage" || family === "hotel" || family === "omra"}
                  />
                </fieldset>
              </div>
            </div>
          </section>
        )
    }
  }

  return (
    <div className={`min-h-screen ${st.page} text-gray-900 pb-20 sm:pb-0`} dir={dir} data-family={family} style={vars} data-custom-colors={primary ? "yes" : undefined}>
      {preview && <div className="bg-amber-100 text-amber-900 text-sm font-bold text-center py-2 px-3" role="status">{t.preview}</div>}
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
              {design?.cta.whatsapp && <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "hero" })} className="inline-block bg-[#25D366] text-white font-black px-6 py-3 rounded-2xl">💬 {t.whatsappCta}</a>}
            </div>
          </div>
        </div>
      </header>

      {(design ? visibleSections(design) : (SECTIONS[family] as DesignSection[])).map((k) => section(k))}

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t px-3 py-2 grid grid-cols-[1fr_auto_auto] gap-2">
        <a href="#reservation" className={`text-white font-black rounded-xl py-3 text-center ${st.button}`}>{ctaLabel}</a>
        <a href={wa()} target="_blank" rel="noopener noreferrer" onClick={onWa({ location: "sticky" })} className="bg-[#25D366] text-white font-black rounded-xl px-4 py-3" aria-label="WhatsApp">💬</a>
        <a href={`tel:+216${PHONE_NUMBER}`} aria-label={t.call} className="border rounded-xl px-4 py-3">📞</a>
      </div>
    </div>
  )
}
