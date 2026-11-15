import Image from "next/image"
import Link from "next/link"
import type { MouseEvent } from "react"

const FOOTER_TXT = {
  fr: { brand: "Easy2Book · Centrale de Réservation", whatsapp: "WhatsApp", legal: "Mentions légales" },
  en: { brand: "Easy2Book · Booking centre", whatsapp: "WhatsApp", legal: "Legal notice" },
  ar: { brand: "Easy2Book · مركز الحجز", whatsapp: "واتساب", legal: "الإشعارات القانونية" },
} as const

/** Pied de page compact Easy2Book : logo sur plaque blanche, coordonnées officielles, mentions légales. */
export function Easy2BookFooter({ name, phone, phoneLabel, whatsappHref, onWhatsApp, website = "www.easy2book.tn", legalHref = "/mentions-legales", lang = "fr" }: { name: string; phone: string; phoneLabel: string; whatsappHref: string; onWhatsApp?: (e: MouseEvent<HTMLAnchorElement>) => void; website?: string; legalHref?: string; lang?: "fr" | "ar" | "en" }) {
  const t = FOOTER_TXT[lang]
  return (
    <footer className="bg-e2b-blue text-white border-t-4 border-e2b-yellow" data-testid="brochure-footer">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-white/85">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1"><Image src="/logo.png" alt="Easy2Book, centrale de réservation" width={44} height={44} className="w-11 h-11 object-contain" /></span>
          <span className="leading-tight">
            <span className="block font-black text-white">{t.brand}</span>
            <span className="block text-xs text-white/75">{name}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold">
          <a href={`tel:${phone}`} className="text-white" dir="ltr">📞 {phoneLabel}</a>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className="text-white underline">{t.whatsapp}</a>
          <span dir="ltr">{website}</span>
          <Link href={legalHref} className="text-xs font-normal underline">{t.legal}</Link>
        </div>
      </div>
    </footer>
  )
}
