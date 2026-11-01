"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { LeadCaptureForm } from "../components/LeadCaptureForm"
import { PHONE_NUMBER, SOCIAL_LINKS, WHATSAPP_NUMBER } from "@/lib/config"
import { handleWhatsAppClick, trackEvent as sendEvent } from "@/lib/tracking"

// ---------------------------------------------------------------------------
// Données métier (source unique : cartes, formulaire, messages WhatsApp, suivi)
// ---------------------------------------------------------------------------

interface OmraPackage {
  id: string
  name: string
  date: string
  monthLabel: string
  price: number
  nights: number
  makkah: number
  madinah: number
  tag: string
  accent: string
}

const PACKAGES: OmraPackage[] = [
  { id: "foj1", name: "الفوج الأول", date: "27 جانفي 2027", monthLabel: "جانفي 2027", price: 5500, nights: 14, makkah: 10, madinah: 4, tag: "✈️ أول فوج", accent: "emerald" },
  { id: "foj2", name: "الفوج الثاني", date: "18 فيفري 2027", monthLabel: "فيفري 2027", price: 7800, nights: 25, makkah: 20, madinah: 5, tag: "⭐ الإقامة الأطول", accent: "amber" },
  { id: "foj3", name: "عمرة شوال", date: "15 مارس 2027", monthLabel: "مارس 2027", price: 4800, nights: 14, makkah: 10, madinah: 4, tag: "🕌 السعر الأقل", accent: "violet" },
]

// Libellé enregistré dans le CRM (champ « offre ») et proposé dans le formulaire
const offerLabel = (p: OmraPackage) => `${p.name} — ${p.date}`

const OMRA_PRICE_FROM = Math.min(...PACKAGES.map((p) => p.price))

// Format fixe (identique serveur / navigateur : pas de toLocaleString → pas d'erreur d'hydratation)
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

function Price({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={className}>
      <span dir="ltr">{fmt(value)}</span> د.ت
    </span>
  )
}

const INCLUDED = [
  { icon: "✈️", text: "تذكرة الطائرة ذهاباً وإياباً" },
  { icon: "🪪", text: "تأشيرة العمرة + التأمين الصحي" },
  { icon: "🏨", text: "فندق أرائك غزة ⭐⭐⭐ قريب من الحرم" },
  { icon: "🚪", text: "دخول مباشر لمكة لأداء العمرة" },
  { icon: "🚌", text: "التنقلات بحافلات سياحية مريحة" },
  { icon: "🕋", text: "زيارة المزارات في مكة والمدينة" },
  { icon: "👩", text: "مرافقون ذوو خبرة + مرافقة نسائية" },
  { icon: "🎁", text: "هدايا للمعتمرين" },
]

const STEPS = [
  { n: "1", title: "اختر الفوج", text: "عبّي الاستمارة في أقل من دقيقة: الاسم، الهاتف، الفوج وعدد الأشخاص." },
  { n: "2", title: "مستشارنا يتصل بيك", text: "نأكدولك الأماكن المتوفرة، البرنامج والوثائق المطلوبة على الهاتف أو واتساب." },
  { n: "3", title: "تأكيد الحجز", text: "تحجز مكانك وتتابع معانا كل التحضيرات حتى نهار السفر." },
]

const FAQ = [
  {
    q: "شنوة يشمل السعر؟",
    a: "الطيران ذهاباً وإياباً، تأشيرة العمرة والتأمين الصحي، الإقامة في فندق أرائك غزة ⭐⭐⭐ قريب من الحرم، التنقلات بالحافلات، زيارة المزارات، المرافقة (منها مرافقة نسائية) وهدايا للمعتمرين.",
  },
  {
    q: "شنوة الفرق بين الأفواج؟",
    a: "نفس الخدمات في الأفواج الثلاثة. الفرق في تاريخ السفر ومدة الإقامة: 14 ليلة (10 بمكة + 4 بالمدينة) للفوج الأول وعمرة شوال، و25 ليلة (20 بمكة + 5 بالمدينة) للفوج الثاني.",
  },
  {
    q: "كيفاش نستفيد من عرض المجموعات؟",
    a: "لكل 10 أشخاص عمرة مجانية، وأسعار خاصة للعائلات والمجموعات. اختر عدد الأشخاص في الاستمارة أو احكي معانا على واتساب.",
  },
  {
    q: "فما مرافقة للنساء؟",
    a: "نعم، المجموعة ترافقها مرافقة نسائية ذات خبرة إلى جانب المرافقين والمرشدين.",
  },
]

// ---------------------------------------------------------------------------
// Suivi
// ---------------------------------------------------------------------------

const NICHE = "omra-ramadan-2027"

function packageByOffer(offer: string) {
  return PACKAGES.find((p) => offer.startsWith(p.name))
}

function trackPackageChoice(pkg: OmraPackage, location: string) {
  sendEvent("ViewContent", {
    product: "omra",
    niche: NICHE,
    content_name: offerLabel(pkg),
    content_category: "Omra Package",
    content_ids: pkg.id,
    content_location: location,
    value: pkg.price,
    currency: "TND",
  })
}

function waMessage(pkg?: OmraPackage, group = false) {
  if (group) return "السلام عليكم Easy2Book، نحب نستفسر على عرض المجموعات للعمرة (عمرة مجانية لكل 10 أشخاص). 🕋\nعدد الأشخاص: "
  if (pkg)
    return `السلام عليكم Easy2Book، نحب نحجز ${offerLabel(pkg)} (${pkg.nights} ليلة — ${pkg.price} د.ت). 🕋\nعدد الأشخاص: `
  return "السلام عليكم Easy2Book، نحب نستفسر على عروض العمرة رمضان / شوال 2027. 🕋\nعدد الأشخاص: "
}

function WhatsAppLink({
  children,
  className,
  location,
  pkg,
  group = false,
}: {
  children: React.ReactNode
  className?: string
  location: string
  pkg?: OmraPackage
  group?: boolean
}) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage(pkg, group))}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) =>
        handleWhatsAppClick(e, {
          product: "omra",
          location,
          offer: group ? "عرض المجموعات" : pkg ? offerLabel(pkg) : undefined,
          niche: NICHE,
          value: pkg?.price ?? OMRA_PRICE_FROM,
        })
      }
      className={className}
    >
      {children}
    </a>
  )
}

const accentCls: Record<string, { ring: string; chip: string; btn: string }> = {
  emerald: { ring: "ring-emerald-500", chip: "bg-emerald-100 text-emerald-800", btn: "bg-emerald-600 hover:bg-emerald-700" },
  amber: { ring: "ring-amber-500", chip: "bg-amber-100 text-amber-800", btn: "bg-amber-500 hover:bg-amber-600" },
  violet: { ring: "ring-violet-500", chip: "bg-violet-100 text-violet-800", btn: "bg-violet-600 hover:bg-violet-700" },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OmraPage() {
  const [offer, setOffer] = useState("")
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const selected = packageByOffer(offer)

  // Profondeur de défilement (25 / 50 / 75 %) — une fois par palier
  useEffect(() => {
    const seen = new Set<string>()
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = (window.scrollY / max) * 100
      const depth = pct >= 75 ? "75%" : pct >= 50 ? "50%" : pct >= 25 ? "25%" : null
      if (depth && !seen.has(depth)) {
        seen.add(depth)
        sendEvent("ScrollDepth", { depth, page: "omra" })
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // « احجز هذا الفوج » : pré-remplit le formulaire et y amène le visiteur (le lead arrive dans le CRM)
  const choosePackage = (pkg: OmraPackage, location: string) => {
    setOffer(offerLabel(pkg))
    trackPackageChoice(pkg, location)
    goToForm()
  }

  const goToForm = () => {
    document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-gray-900 pb-20 sm:pb-0" dir="rtl">
      {/* EN-TÊTE */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <a href="#top" className="flex items-center gap-2 min-w-0">
            <Image src="/logo.png" alt="Easy2Book" width={36} height={36} className="rounded-full shrink-0" />
            <div className="min-w-0">
              <div className="font-extrabold text-sm leading-tight">Easy2Book</div>
              <div className="text-[11px] text-emerald-700 truncate">عمرة رمضان وشوال 2027</div>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-emerald-800 px-3 py-2"
              aria-label="اتصل بنا"
            >
              📞 <span dir="ltr">98 140 514</span>
            </a>
            <button
              type="button"
              onClick={goToForm}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold px-4 py-2 rounded-full"
            >
              احجز مكانك
            </button>
          </div>
        </div>
      </header>

      {/* HERO — image réelle issue de la vidéo Easy2Book */}
      <section id="top" className="relative pt-14 overflow-hidden">
        <Image src="/omra-hero.jpg" alt="معتمرون مع Easy2Book في الحرم" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/75 via-emerald-950/65 to-emerald-950/90" />
        <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-12 sm:pt-16 sm:pb-16 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-300/40 text-amber-200 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full mb-5">
            🕋 فتح باب التسجيل — الأماكن محدودة
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3">
            عمرة رمضان وشوال <span className="text-amber-300">2027</span>
          </h1>
          <p className="text-base sm:text-lg text-emerald-50/90 mb-6 leading-relaxed">
            3 أفواج: <strong>27 جانفي</strong> · <strong>18 فيفري</strong> · <strong>15 مارس</strong>
            <br />
            طيران + تأشيرة + فندق قريب من الحرم + مرافقة نسائية
          </p>

          <div className="inline-flex items-end gap-2 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 mb-7">
            <span className="text-sm text-emerald-50/80 pb-1">ابتداءً من</span>
            <Price value={OMRA_PRICE_FROM} className="text-4xl sm:text-5xl font-black text-amber-300" />
            <span className="text-sm text-emerald-50/80 pb-1">/ للشخص</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#aflaj"
              className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-lg px-8 py-4 rounded-2xl shadow-xl"
            >
              اختر فوجك ←
            </a>
            <WhatsAppLink
              location="hero"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl"
            >
              💬 استفسر على واتساب
            </WhatsAppLink>
          </div>

          <ul className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
            {["✈️ طيران مشمول", "🪪 تأشيرة + تأمين", "🏨 قريب من الحرم", "🎁 عمرة مجانية لكل 10"].map((t) => (
              <li key={t} className="bg-white/10 border border-white/15 rounded-xl py-2 px-2 font-semibold">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LES 3 DÉPARTS */}
      <section id="aflaj" className="scroll-mt-16 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-4xl font-black mb-2">اختر الفوج المناسب ليك</h2>
            <p className="text-gray-600">نفس الخدمات في كل الأفواج — الفرق في التاريخ ومدة الإقامة</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PACKAGES.map((pkg) => {
              const a = accentCls[pkg.accent]
              const isSelected = selected?.id === pkg.id
              return (
                <article
                  key={pkg.id}
                  className={`bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col ${isSelected ? `ring-2 ${a.ring}` : ""}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black">{pkg.name}</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${a.chip}`}>{pkg.tag}</span>
                  </div>

                  <div className="text-gray-700 font-bold mb-1">🗓️ السفر: {pkg.date}</div>
                  <div className="text-gray-600 text-sm mb-4">
                    🛏️ {pkg.nights} ليلة — {pkg.makkah} بمكة + {pkg.madinah} بالمدينة
                  </div>

                  <div className="mb-5">
                    <Price value={pkg.price} className="text-4xl font-black text-emerald-800" />
                    <div className="text-xs text-gray-500 mt-1">للشخص — كل شيء مشمول</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => choosePackage(pkg, `package-${pkg.id}`)}
                    className={`mt-auto w-full text-white font-black py-3.5 rounded-2xl ${a.btn}`}
                  >
                    احجز هذا الفوج
                  </button>
                  <WhatsAppLink
                    location={`package-${pkg.id}`}
                    pkg={pkg}
                    className="mt-2 block text-center text-sm font-bold text-emerald-700 hover:text-emerald-900 py-2"
                  >
                    💬 أو اسأل على واتساب
                  </WhatsAppLink>
                </article>
              )
            })}
          </div>

          {/* Inclus — affiché une seule fois au lieu de 3 listes identiques */}
          <div className="mt-8 bg-white rounded-3xl border border-gray-100 p-6">
            <h3 className="font-black text-lg mb-4 text-center">✅ كل الأفواج تشمل</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {INCLUDED.map((i) => (
                <li key={i.text} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-lg leading-5">{i.icon}</span>
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* OFFRE GROUPES — reprise du message de la vidéo Easy2Book */}
      <section className="bg-amber-400">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right">
          <div className="text-5xl">🎁</div>
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-black text-emerald-950">عمرة مجانية لكل 10 أشخاص</h2>
            <p className="text-emerald-950/80 font-semibold mt-1">أسعار خاصة للعائلات والمجموعات — لمّ عايلتك وأحبابك</p>
          </div>
          <WhatsAppLink
            location="group-offer"
            group
            className="bg-emerald-950 hover:bg-emerald-900 text-white font-black px-6 py-3.5 rounded-2xl whitespace-nowrap"
          >
            💬 احسب عرض مجموعتك
          </WhatsAppLink>
        </div>
      </section>

      {/* VIDÉO */}
      <section className="py-12 sm:py-16 bg-emerald-950 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-2">خدمة المعتمرين شرف لنا</h2>
          <p className="text-emerald-100/80 mb-6">شاهد الفيديو واكتشف أجواء الرحلة مع Easy2Book</p>
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black aspect-video">
            <video className="w-full h-full object-cover" controls playsInline poster="/omra-ramadan-2027-poster.jpg" preload="none">
              <source src="/omra-ramadan-2027.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* COMMENT RÉSERVER */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-8">كيفاش تحجز؟</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-white rounded-3xl border border-gray-100 p-6">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-black flex items-center justify-center mb-3">{s.n}</div>
                <h3 className="font-black text-lg mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FORMULAIRE — le lead est enregistré dans le CRM puis le visiteur continue sur WhatsApp */}
      <section id="reservation" className="scroll-mt-16 py-12 sm:py-16 bg-emerald-50">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-black mb-2">احجز مكانك الآن</h2>
            <p className="text-gray-600">أقل من دقيقة — مستشارنا يتصل بيك لتأكيد الأماكن</p>
          </div>

          {selected && (
            <div className="mb-4 bg-white border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-black text-emerald-900">{selected.name} — {selected.date}</div>
                <div className="text-gray-600">
                  {selected.nights} ليلة · <Price value={selected.price} /> للشخص
                </div>
              </div>
              <button type="button" onClick={() => setOffer("")} className="text-gray-500 hover:text-gray-800 underline shrink-0">
                تغيير
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-5 sm:p-6">
            <LeadCaptureForm
              product="omra"
              lang="ar"
              formId="omra-lead-form"
              niche={NICHE}
              offers={PACKAGES.map(offerLabel)}
              offerValue={offer}
              onOfferChange={setOffer}
              showDate={false}
              showPromo
              adultOptions={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]}
            />
          </div>
          <p className="text-center text-xs text-gray-500 mt-3">
            تفضّل الهاتف؟ اتصل بنا على{" "}
            <a href={`tel:+216${PHONE_NUMBER}`} className="font-bold text-emerald-800" dir="ltr">
              98 140 514
            </a>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-6">أسئلة متكررة</h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="bg-white rounded-2xl border border-gray-100">
                <button
                  type="button"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right font-bold"
                >
                  <span>{f.q}</span>
                  <span className="text-emerald-700 text-xl leading-none">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PIED DE PAGE */}
      <footer className="bg-emerald-950 text-emerald-100/70 py-10 text-center text-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/logo.png" alt="Easy2Book" width={32} height={32} className="rounded-full" />
            <span className="text-white font-extrabold">Easy2Book</span>
          </div>
          <p className="mb-4">خدمة المعتمرين شرف لنا 🕋</p>
          <div className="flex gap-5 justify-center flex-wrap font-semibold">
            <a href={`tel:+216${PHONE_NUMBER}`} className="text-white" dir="ltr">
              📞 98 140 514
            </a>
            <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Facebook
            </a>
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Instagram
            </a>
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              TikTok
            </a>
          </div>
          <p className="mt-5 text-xs text-emerald-100/40">© 2026 Easy2Book</p>
        </div>
      </footer>

      {/* BARRE D'ACTION MOBILE */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 px-3 py-2 grid grid-cols-[1fr_auto_auto] gap-2">
        <button
          type="button"
          onClick={goToForm}
          className="bg-emerald-700 text-white font-black rounded-xl py-3"
        >
          احجز مكانك
        </button>
        <WhatsAppLink location="sticky" className="bg-[#25D366] text-white font-bold rounded-xl px-4 py-3" pkg={selected}>
          واتساب
        </WhatsAppLink>
        <a href={`tel:+216${PHONE_NUMBER}`} aria-label="اتصل بنا" className="border border-gray-300 rounded-xl px-4 py-3 font-bold">
          📞
        </a>
      </div>
    </div>
  )
}
