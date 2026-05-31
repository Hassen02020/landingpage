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
  } catch (error) {
    console.error("CAPI send failed:", error)
  }
}

function trackWhatsAppClick(location: string = "general", packageName: string = ""): void {
  sendEvent("Contact", {
    content_category: "Omra Ete 2026",
    content_name: location,
    content_ids: packageName,
    value: 4100,
    currency: "TND",
    user_segment: "omra_visitor",
  })
}

function trackPackageClick(packageName: string, price: number, month: string): void {
  sendEvent("ViewContent", {
    content_name: packageName,
    content_category: "Omra Package",
    content_ids: packageName,
    value: price,
    currency: "TND",
    month: month,
  })
}

function trackScrollDepth(depth: string): void {
  sendEvent("ScrollDepth", {
    depth,
    page: "omra",
    engagement_level: depth === "75%" || depth === "100%" ? "high" : "medium",
  })
}

const PROGRAM_FEATURES = [
  "🪪 تأشيرة العمرة والتأمين الصحي",
  "✈️ تذكرة الطائرة ذهاباً وإياباً",
  "🏨 فندق ⭐⭐⭐ قريب من الحرم — فندق أرائك غزة",
  "🛏️ 10 ليالي بمكة + 4 ليالي بالمدينة",
  "🚌 نقل بحافلات سياحية مريحة",
  "🕋 زيارة المزارات التاريخية في مكة والمدينة",
  "🚪 دخول مباشر لمكة للعمرة",
  "👤 مرافقون ذوو خبرة مع مرافقة نسائية",
  "🎁 هدايا للمعتمرين",
]

const PACKAGES = [
  {
    id: "foj1",
    name: "الفوج الأول",
    date: "28 جوان 2026",
    dateLabel: "Juin 2026",
    price: 4100,
    emoji: "🌙",
    badge: "Départ Juin",
    badgeColor: "bg-emerald-500",
    features: PROGRAM_FEATURES,
  },
  {
    id: "foj2",
    name: "الفوج الثاني",
    date: "28 جويلية 2026",
    dateLabel: "Juillet 2026",
    price: 4100,
    emoji: "⭐",
    badge: "Départ Juillet",
    badgeColor: "bg-amber-500",
    features: PROGRAM_FEATURES,
  },
]

const ADVANTAGES = [
  {
    icon: "🏨",
    title: "فندق أرائك غزة ⭐⭐⭐",
    subtitle: "Hôtel 3★ proche du Haram",
    description: "10 nuits à La Mecque + 4 nuits à Médine dans un hôtel 3 étoiles soigneusement sélectionné, à proximité immédiate des lieux saints.",
  },
  {
    icon: "🪪",
    title: "تأشيرة وتأمين صحي",
    subtitle: "Visa + assurance inclus",
    description: "Nous prenons en charge tous les démarches administratives : visa Omra et assurance maladie complète inclus dans le prix.",
  },
  {
    icon: "🕋",
    title: "زيارة المزارات التاريخية",
    subtitle: "Visites guidées Mecque & Médine",
    description: "Programme enrichissant avec visites des sites historiques et spirituels à La Mecque et Médine, accompagné par nos guides experts.",
  },
  {
    icon: "🎁",
    title: "هدايا للمعتمرين + عمرة مجانية",
    subtitle: "Cadeaux + Omra gratuite / 10 personnes",
    description: "Chaque pèlerin reçoit des cadeaux spéciaux. Et pour chaque groupe de 10 personnes, une Omra entièrement offerte !",
  },
  {
    icon: "�",
    title: "مرافقة نسائية متخصصة",
    subtitle: "Accompagnatrice féminine dédiée",
    description: "Accompagnatrice féminine expérimentée + accompagnateurs experts pour une expérience sereine, sécurisée et spirituellement enrichissante.",
  },
  {
    icon: "🚪",
    title: "دخول مباشر لمكة",
    subtitle: "Entrée directe à La Mecque",
    description: "Dès l'arrivée, accès direct à La Mecque pour accomplir l'Omra sans délai. Transport confortable en bus touristique tout au long du séjour.",
  },
]

function CTAButton({
  label,
  className,
  location,
  packageName = "",
}: {
  label: string
  className?: string
  location: string
  packageName?: string
}) {
  const message = encodeURIComponent(
    packageName
      ? `Bonjour Easy2Book, je souhaite réserver le package Omra ${packageName} (4100 TND / 14 jours). Merci de me contacter.`
      : "Bonjour Easy2Book, je souhaite me renseigner sur les packages Omra Été 2026. Merci."
  )
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick(location, packageName)}
      className={className}
    >
      {label}
    </a>
  )
}

export default function OmraPage() {
  const [activeTab, setActiveTab] = useState("foj1")

  useEffect(() => {
    let trackedDepths = new Set<string>()
    let timeOnPage = 0
    let engagementInterval: number

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      )
      const depth =
        scrollPercent >= 75 ? "75%" : scrollPercent >= 50 ? "50%" : scrollPercent >= 25 ? "25%" : null
      if (depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth)
        trackScrollDepth(depth)
      }
    }

    engagementInterval = window.setInterval(() => {
      timeOnPage += 30
      sendEvent("PageEngagement", {
        time_on_page: timeOnPage,
        page: "omra",
        user_intent: timeOnPage >= 60 ? "ready_to_book" : "considering",
      })
    }, 30000)

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.clearInterval(engagementInterval)
    }
  }, [])

  const activePackage = PACKAGES.find((p) => p.id === activeTab) || PACKAGES[0]

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="Easy2Book" width={40} height={40} className="rounded-full" />
            <div>
              <div className="font-bold text-gray-900 text-sm">Easy2Book</div>
              <div className="text-xs text-emerald-600">عمرة العطلة الصيفية 2026</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              📞 {PHONE_NUMBER}
            </a>
            <CTAButton
              label="💬 Réserver WhatsApp"
              location="header"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-full transition-all shadow"
            />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        className="relative min-h-screen flex items-center justify-center pt-16"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #065f46 30%, #1a1a2e 70%, #0f172a 100%)",
        }}
      >
        {/* Stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 3 + 1 + "px",
                height: Math.random() * 3 + 1 + "px",
                top: Math.random() * 100 + "%",
                left: Math.random() * 100 + "%",
                opacity: Math.random() * 0.7 + 0.3,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center py-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-sm font-semibold px-4 py-2 rounded-full mb-6">
            🕋 عمرة الصيف 2026 — Juin & Juillet
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
            صيفك هالسنة{" "}
            <span className="text-amber-400">غير عادي</span>
            <br />
            <span className="text-2xl sm:text-3xl font-bold text-emerald-300">
              رحلة العمر في رحاب الحرمين الشريفين
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            برنامج مدروس بدقة — سكن قريب من الحرم — مرافقة خبيرة — راحة البال التامة
          </p>

          {/* Price badge */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-6 py-4 mb-8">
            <div className="text-center">
              <div className="text-amber-400 font-black text-4xl">4 100</div>
              <div className="text-white/80 text-sm">دينار تونسي / شخص</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div className="text-left">
              <div className="text-white font-bold">14 يوم</div>
              <div className="text-emerald-300 text-sm">vol inclus ✈️</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <CTAButton
              label="💬 احجز مكانك على WhatsApp"
              location="hero"
              className="bg-green-500 hover:bg-green-400 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-2xl transition-all transform hover:scale-105"
            />
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all"
            >
              📞 اتصل بنا: {PHONE_NUMBER}
            </a>
          </div>

          {/* USPs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { icon: "🏨", text: "فندق أرائك غزة ⭐⭐⭐" },
              { icon: "🪪", text: "تأشيرة + تأمين صحي" },
              { icon: "👩", text: "مرافقة نسائية" },
              { icon: "🎁", text: "هدايا + عمرة مجانية" },
            ].map((usp, i) => (
              <div key={i} className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{usp.icon}</div>
                <div className="text-white text-xs font-semibold">{usp.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEO SECTION */}
      <section className="py-14 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-sm font-semibold px-4 py-2 rounded-full mb-6">
            🎬 شاهد برنامجنا
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-8">
            اكتشف تفاصيل رحلة العمر
          </h2>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <video
              className="w-full max-h-[500px] object-cover"
              controls
              playsInline
              poster="/hero-bg.jpg"
              preload="metadata"
            >
              <source src="/omra-video.mp4" type="video/mp4" />
              متصفحك لا يدعم تشغيل الفيديو.
            </video>
          </div>
          <div className="mt-6">
            <CTAButton
              label="💬 احجز مكانك بعد المشاهدة"
              location="video-cta"
              className="inline-block bg-green-500 hover:bg-green-400 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* PACKAGES SECTION */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              🗓️ اختر موعدك
            </h2>
            <p className="text-gray-600 text-lg">فوجان متاحان — نفس السعر، نفس الخدمة المميزة</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 justify-center mb-8">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => {
                  setActiveTab(pkg.id)
                  trackPackageClick(pkg.name, pkg.price, pkg.dateLabel)
                }}
                className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                  activeTab === pkg.id
                    ? "bg-emerald-600 text-white shadow-lg scale-105"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-emerald-300"
                }`}
              >
                {pkg.emoji} {pkg.dateLabel}
              </button>
            ))}
          </div>

          {/* Package Card */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-2xl mx-auto">
            <div className={`${activePackage.badgeColor} text-white text-center py-3 font-bold text-lg`}>
              {activePackage.emoji} {activePackage.name} — {activePackage.date}
            </div>
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="text-5xl font-black text-emerald-700">
                  {activePackage.price.toLocaleString()} <span className="text-2xl">TND</span>
                </div>
                <div className="text-gray-500 mt-1">par personne — 14 jours tout inclus</div>
              </div>

              <ul className="space-y-3 mb-8">
                {activePackage.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <span className="text-lg">{feature.split(" ")[0]}</span>
                    <span>{feature.split(" ").slice(1).join(" ")}</span>
                  </li>
                ))}
              </ul>

              <CTAButton
                label={`💬 احجز ${activePackage.dateLabel} — 4100 TND`}
                location={`package-${activePackage.id}`}
                packageName={`${activePackage.name} — ${activePackage.dateLabel}`}
                className="block w-full bg-green-500 hover:bg-green-600 text-white font-black text-lg py-4 rounded-2xl text-center transition-all shadow-lg hover:shadow-xl"
              />

              <p className="text-center text-gray-500 text-sm mt-3">
                الأماكن محدودة — احجز مكانك الآن! 🔥
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GROUP OFFER */}
      <section className="py-12 bg-gradient-to-r from-amber-400 to-amber-500">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            عرض المجموعات الذهبي
          </h2>
          <p className="text-amber-900 text-lg font-semibold mb-2">
            لكل 10 أشخاص ← عمرة مجانية!
          </p>
          <p className="text-amber-800 mb-6">
            لمّ شلّتك أو عايلتك واستفيدوا من هذا العرض الاستثنائي. خصومات فورية من 3 أشخاص فأكثر.
          </p>
          <CTAButton
            label="💬 استفسر عن عرض المجموعات"
            location="group-offer"
            packageName="عرض المجموعات"
            className="inline-block bg-white text-amber-700 font-black text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          />
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              لماذا تختار Easy2Book؟
            </h2>
            <p className="text-gray-600 text-lg">نرافقكم في كل خطوة لرحلة العمر ✈️🌙</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADVANTAGES.map((adv, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-all border border-gray-100">
                <div className="text-4xl mb-3">{adv.icon}</div>
                <div className="font-bold text-gray-900 text-lg mb-1 text-right">{adv.title}</div>
                <div className="text-emerald-600 font-semibold text-sm mb-2">{adv.subtitle}</div>
                <p className="text-gray-600 text-sm leading-relaxed">{adv.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATES SECTION */}
      <section className="py-12 bg-emerald-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-8">📅 المواعيد المتاحة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
                <div className="text-4xl mb-3">{pkg.emoji}</div>
                <div className="text-xl font-black mb-1">{pkg.name}</div>
                <div className="text-emerald-300 font-bold text-lg mb-3">📍 {pkg.date}</div>
                <div className="text-2xl font-black text-amber-400 mb-4">
                  {pkg.price.toLocaleString()} TND
                </div>
                <CTAButton
                  label={`💬 احجز ${pkg.dateLabel}`}
                  location={`dates-${pkg.id}`}
                  packageName={`${pkg.name} — ${pkg.dateLabel}`}
                  className="block w-full bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl text-center transition-all"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-16 bg-gray-900 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-5xl mb-4">🕋</div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            لا تضيع الفرصة
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            الأماكن محدودة — تواصل معانا الآن وضمن مكانك في رحلة العمر
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton
              label="💬 احجز على WhatsApp الآن"
              location="bottom-cta"
              className="bg-green-500 hover:bg-green-400 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-105"
            />
            <a
              href={`tel:+216${PHONE_NUMBER}`}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all"
            >
              📞 {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-gray-500 py-8 text-center text-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/logo.jpg" alt="Easy2Book" width={32} height={32} className="rounded-full" />
            <span className="text-white font-bold">Easy2Book</span>
          </div>
          <p className="mb-3">نرافقكم في كل خطوة لرحلة العمر ✈️🌙</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick("footer")}
              className="text-green-400 hover:text-green-300 font-semibold"
            >
              💬 WhatsApp
            </a>
            <a
              href="https://www.facebook.com/Easy2Bookplateforme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              📘 Facebook
            </a>
            <a href="/summer-vibes" className="text-amber-400 hover:text-amber-300 font-semibold">
              ☀️ Summer Vibes
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-600">© 2026 Easy2Book. Tous droits réservés.</p>
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
