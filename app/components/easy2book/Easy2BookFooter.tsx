import Image from "next/image"
import Link from "next/link"
import type { MouseEvent } from "react"
import { SOCIAL } from "@/lib/social-links"
import { PhoneText } from "@/lib/design-system/bidi"

const FOOTER_TXT = {
  fr: { whatsapp: "WhatsApp", legal: "Mentions légales", social: "Réseaux sociaux" },
  en: { whatsapp: "WhatsApp", legal: "Legal notice", social: "Social media" },
  ar: { whatsapp: "واتساب", legal: "الإشعارات القانونية", social: "مواقع التواصل الاجتماعي" },
} as const

/**
 * Pied de page compact Easy2Book : logo SANS plaque (le logo officiel est transparent, il se pose sur un fond clair),
 * coordonnées officielles, réseaux sociaux officiels, mentions légales. Le logo contient déjà « Centrale de réservation » : aucun texte ne le répète.
 */
export function Easy2BookFooter({ name, phone, phoneLabel, whatsappHref, onWhatsApp, website = "www.easy2book.tn", legalHref = "/mentions-legales", lang = "fr" }: { name: string; phone: string; phoneLabel: string; whatsappHref: string; onWhatsApp?: (e: MouseEvent<HTMLAnchorElement>) => void; website?: string; legalHref?: string; lang?: "fr" | "ar" | "en" }) {
  const t = FOOTER_TXT[lang]
  return (
    <footer className="bg-white text-e2b-ink border-t-4 border-e2b-yellow" data-testid="brochure-footer">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-5 text-sm">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Easy2Book, centrale de réservation" width={96} height={96} className="w-20 h-20 object-contain" />
          <span className="leading-tight">
            <span className="block font-black text-e2b-blue text-2xl">Easy2Book</span>
            <span className="block text-xs text-e2b-ink/70">{name}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold">
          <a href={`tel:${phone}`} className="text-e2b-ink">📞 <PhoneText>{phoneLabel}</PhoneText></a>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className="text-e2b-wa underline">{t.whatsapp}</a>
          <PhoneText>{website}</PhoneText>
          <Link href={legalHref} className="text-xs font-normal underline">{t.legal}</Link>
        </div>
        <ul className="flex items-center gap-2" aria-label={t.social} data-testid="footer-social">
          {SOCIAL.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="inline-flex w-11 h-11 items-center justify-center rounded-full bg-e2b-blue hover:bg-e2b-blue-dark">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white" aria-hidden="true"><path d={s.d} /></svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
