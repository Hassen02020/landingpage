"use client"

import { useState } from "react"
import Script from "next/script"
import { getAttribution } from "@/lib/attribution"
import { hasTrackingConsent } from "@/lib/consent"
import { PRODUCTS, TURNSTILE_SITE_KEY, type Product } from "@/lib/config"
import { buildWhatsAppUrl, generateEventId, trackEvent } from "@/lib/tracking"

type Lang = "fr" | "ar"

const T = {
  fr: {
    name: "Nom complet",
    phone: "Téléphone (ex. 98 140 514)",
    product: "Je suis intéressé(e) par",
    offer: "Offre souhaitée",
    anyOffer: "Je ne sais pas encore",
    destination: "Destination",
    date: "Date de départ souhaitée",
    period: "Période souhaitée",
    adults: "Adultes",
    children: "Enfants",
    budget: "Budget approximatif",
    message: "Précisions (facultatif)",
    consent: "J'accepte qu'Easy2Book me recontacte par téléphone / WhatsApp au sujet de ma demande. (obligatoire)",
    marketing: "J'accepte de recevoir les offres et promotions Easy2Book par WhatsApp / téléphone (facultatif).",
    submit: "🟢 Envoyer et continuer sur WhatsApp",
    sending: "Envoi en cours…",
    success: "✓ Demande enregistrée ! Votre référence :",
    openWa: "Ouvrir WhatsApp",
    phoneError: "Numéro invalide : 8 chiffres (ex. 98 140 514) ou format international (+33…).",
    nameError: "Merci d'indiquer votre nom.",
    consentError: "Merci de cocher la case d'accord.",
    genericError: "Une erreur est survenue. Vous pouvez nous écrire directement sur WhatsApp.",
  },
  ar: {
    name: "الاسم واللقب",
    phone: "رقم الهاتف (مثال 98140514)",
    product: "أنا مهتم بـ",
    offer: "الفوج / العرض",
    anyOffer: "لم أحدد بعد",
    destination: "الوجهة",
    date: "تاريخ السفر المرغوب",
    period: "الفترة المرغوبة",
    adults: "الكبار",
    children: "الأطفال",
    budget: "الميزانية التقريبية",
    message: "ملاحظات (اختياري)",
    consent: "أوافق على أن تتصل بي Easy2Book عبر الهاتف / واتساب بخصوص طلبي. (إجباري)",
    marketing: "أوافق على تلقي عروض Easy2Book عبر واتساب / الهاتف (اختياري).",
    submit: "🟢 أرسل وواصل على واتساب",
    sending: "جاري الإرسال…",
    success: "✓ تم تسجيل طلبك! رقم المرجع:",
    openWa: "افتح واتساب",
    phoneError: "رقم غير صحيح: 8 أرقام (مثال 98140514) أو بالصيغة الدولية (+33…).",
    nameError: "الرجاء كتابة الاسم.",
    consentError: "الرجاء الموافقة على التواصل.",
    genericError: "حدث خطأ. يمكنك مراسلتنا مباشرة على واتساب.",
  },
} as const

export interface LeadCaptureFormProps {
  /** Produit fixe (omra / voyage / hotel). Si absent, le visiteur choisit. */
  product?: Product
  offers?: string[]
  defaultOffer?: string
  destinations?: string[]
  periods?: string[]
  budgets?: string[]
  tripTypes?: string[]
  niche?: string
  lang?: Lang
  accentColor?: string
  formId?: string
}

const PHONE_RE = /^(?:(?:\+|00)216)?[234579]\d{7}$|^(?:\+|00)\d{9,15}$/

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"

export function LeadCaptureForm({
  product,
  offers,
  defaultOffer,
  destinations,
  periods,
  budgets,
  tripTypes,
  niche,
  lang = "fr",
  accentColor = "#25D366",
  formId = "lead-form",
}: LeadCaptureFormProps) {
  const t = T[lang]
  const [selectedProduct, setSelectedProduct] = useState<Product>(product || "voyage")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ ref: string; url: string } | null>(null)
  const [started, setStarted] = useState(false)

  const currentProduct = product || selectedProduct

  const onFirstInteraction = () => {
    if (started) return
    setStarted(true)
    trackEvent("FormStart", { product: currentProduct, content_name: formId, niche })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const get = (k: string) => String(fd.get(k) ?? "").trim()

    const name = get("name")
    const phone = get("phone").replace(/[\s.\-()]/g, "")
    if (name.length < 2) return setError(t.nameError)
    if (!PHONE_RE.test(phone)) return setError(t.phoneError)
    if (!fd.get("consent")) return setError(t.consentError)

    setSubmitting(true)
    const eventId = generateEventId()
    const offer = get("offer") || defaultOffer || ""
    const payload = {
      eventId,
      name,
      phone,
      product: currentProduct,
      offer,
      niche: get("niche") || niche,
      destination: get("destination"),
      travel_date: get("travel_date"),
      travel_period: get("travel_period"),
      adults: get("adults") || "1",
      children: get("children") || "0",
      budget: get("budget"),
      trip_type: get("trip_type"),
      message: get("message"),
      contactConsent: true,
      marketingConsent: Boolean(fd.get("marketing")),
      trackingConsent: hasTrackingConsent(),
      website: get("website"),
      captchaToken: get("cf-turnstile-response") || undefined,
      attribution: (() => {
        try {
          return getAttribution()
        } catch {
          return undefined
        }
      })(),
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        const firstFieldError = json.errors ? (Object.values(json.errors)[0] as string) : null
        throw new Error(firstFieldError || json.error || "lead_failed")
      }

      // Pixel navigateur avec le même event_id que l'envoi serveur (déduplication Meta / TikTok)
      trackEvent(
        "Lead",
        {
          product: currentProduct,
          content_category: currentProduct,
          content_name: offer || PRODUCTS[currentProduct],
          content_ids: offer || currentProduct,
          niche: payload.niche,
          value: 1,
          currency: "TND",
        },
        { eventId, skipServer: true }
      )

      setResult({ ref: json.ref, url: json.whatsappUrl })
      form.reset()
      window.location.href = json.whatsappUrl
    } catch (err) {
      // le jeton du captcha est à usage unique : nouveau défi pour un nouvel essai
      try {
        ;(window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset()
      } catch {
        /* ignore */
      }
      const message = err instanceof Error && err.message !== "lead_failed" ? err.message : t.genericError
      setError(message)
      // le prospect peut toujours nous joindre : lien WhatsApp de secours
      const ref = payload.attribution?.ref
      setResult({
        ref: ref || "",
        url: buildWhatsAppUrl(`Bonjour Easy2Book, je suis intéressé(e) par : ${PRODUCTS[currentProduct]}${offer ? ` — ${offer}` : ""}\nNom : ${name}`, ref),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const dir = lang === "ar" ? "rtl" : "ltr"

  return (
    <form id={formId} onSubmit={onSubmit} onFocus={onFirstInteraction} className="space-y-3" dir={dir} noValidate>
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {result && !error && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          {t.success} <strong>{result.ref}</strong>
        </div>
      )}

      {result && (
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl"
        >
          💬 {t.openWa}
        </a>
      )}

      {/* Champ piège anti-robots (invisible pour les humains) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <input name="name" type="text" placeholder={t.name} autoComplete="name" required disabled={submitting} className={inputCls} />
      <input
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder={t.phone}
        autoComplete="tel"
        required
        disabled={submitting}
        className={inputCls}
        dir="ltr"
      />

      {!product && (
        <select
          name="product"
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value as Product)}
          disabled={submitting}
          className={inputCls}
          aria-label={t.product}
        >
          {(Object.keys(PRODUCTS) as Product[]).map((p) => (
            <option key={p} value={p}>
              {PRODUCTS[p]}
            </option>
          ))}
        </select>
      )}

      {offers && offers.length > 0 && (
        <select name="offer" defaultValue={defaultOffer || ""} disabled={submitting} className={inputCls} aria-label={t.offer}>
          <option value="">
            {t.offer} — {t.anyOffer}
          </option>
          {offers.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {destinations && destinations.length > 0 && (
        <select name="destination" defaultValue="" disabled={submitting} className={inputCls} aria-label={t.destination}>
          <option value="">{t.destination}</option>
          {destinations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )}

      {periods && periods.length > 0 ? (
        <select name="travel_period" defaultValue="" disabled={submitting} className={inputCls} aria-label={t.period}>
          <option value="">{t.period}</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      ) : (
        <label className="block text-sm text-gray-600">
          {t.date}
          <input name="travel_date" type="date" disabled={submitting} className={`${inputCls} mt-1`} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <select name="adults" defaultValue="2" disabled={submitting} className={inputCls} aria-label={t.adults}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} {t.adults}
            </option>
          ))}
        </select>
        <select name="children" defaultValue="0" disabled={submitting} className={inputCls} aria-label={t.children}>
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} {t.children}
            </option>
          ))}
        </select>
      </div>

      {tripTypes && tripTypes.length > 0 && (
        <select name="trip_type" defaultValue="" disabled={submitting} className={inputCls}>
          <option value="">Type de séjour</option>
          {tripTypes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      )}

      {budgets && budgets.length > 0 && (
        <select name="budget" defaultValue="" disabled={submitting} className={inputCls} aria-label={t.budget}>
          <option value="">{t.budget}</option>
          {budgets.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}

      <textarea name="message" rows={2} placeholder={t.message} disabled={submitting} className={inputCls} maxLength={1000} />

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input type="checkbox" name="consent" value="1" className="mt-0.5" disabled={submitting} />
        <span>{t.consent}</span>
      </label>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input type="checkbox" name="marketing" value="1" className="mt-0.5" disabled={submitting} />
        <span>{t.marketing}</span>
      </label>

      {TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language={lang} />
        </>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: accentColor, color: "#fff" }}
      >
        {submitting ? t.sending : t.submit}
      </button>
    </form>
  )
}
