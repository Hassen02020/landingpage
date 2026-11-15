"use client"

import Image from "next/image"
import Link from "next/link"
import type { MouseEvent } from "react"
import { PHONE_NUMBER } from "@/lib/config"
import { PhoneIcon, formatPhone } from "./SiteHeader"
import { SOCIAL } from "@/lib/social-links"


type FooterLang = "fr" | "ar" | "en"
// Textes du pied de page par langue (le français reste la valeur par défaut : pages du site déjà en français inchangées)
const TXT: Record<FooterLang, { tagline: string; intro: string; offers: string; contact: string; whatsapp: string; rights: string; legal: string; privacy: string; aria: string; links: { href: string; label: string }[] }> = {
  fr: { tagline: "Centrale de réservation", intro: "Voyages organisés, Omra et promos hôtels en Tunisie. Devis gratuit et réservation sur WhatsApp.", offers: "Nos offres", contact: "Contact", whatsapp: "Écrire sur WhatsApp", rights: "Tous droits réservés.", legal: "Mentions légales", privacy: "Confidentialité", aria: "Pied de page",
    links: [{ href: "/voyages-organises", label: "Voyages organisés" }, { href: "/omra", label: "Omra" }, { href: "/summer-vibes", label: "Promos hôtels" }] },
  en: { tagline: "Booking centre", intro: "Organised trips, Umrah and hotel deals in Tunisia. Free quote and booking on WhatsApp.", offers: "Our offers", contact: "Contact", whatsapp: "Write on WhatsApp", rights: "All rights reserved.", legal: "Legal notice", privacy: "Privacy", aria: "Footer",
    links: [{ href: "/voyages-organises", label: "Organised trips" }, { href: "/omra", label: "Umrah" }, { href: "/summer-vibes", label: "Hotel deals" }] },
  ar: { tagline: "", intro: "رحلات منظمة وعمرة وعروض فنادق في تونس. عرض سعر مجاني وحجز عبر واتساب.", offers: "عروضنا", contact: "اتصل بنا", whatsapp: "راسلنا على واتساب", rights: "جميع الحقوق محفوظة.", legal: "الإشعارات القانونية", privacy: "الخصوصية", aria: "تذييل الصفحة",
    links: [{ href: "/voyages-organises", label: "رحلات منظمة" }, { href: "/omra", label: "العمرة" }, { href: "/summer-vibes", label: "عروض الفنادق" }] },
}

/** Pied de page commun : logo mis en valeur sur fond clair, liens, contact et réseaux. */
export function SiteFooter({ whatsappHref, onWhatsApp, extraPhones = [], lang = "fr" }: { whatsappHref: string; onWhatsApp?: (e: MouseEvent<HTMLAnchorElement>) => void; extraPhones?: string[]; lang?: FooterLang }) {
  const phones = [PHONE_NUMBER, ...extraPhones]
  const t = TXT[lang]
  // en arabe : ni majuscules ni espacement des lettres (ils coupent la liaison des lettres arabes)
  const label = lang === "ar" ? "text-white font-extrabold text-sm mb-4" : "text-white font-extrabold text-sm uppercase tracking-widest mb-4"
  return (
    <footer className="bg-[#071e3d] text-blue-100/80" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl p-3 pr-6 shadow-lg">
            <Image src="/logo.png" alt="Easy2Book, centrale de réservation" width={72} height={72} className="w-[72px] h-[72px] object-contain" />
            <span className="leading-tight">
              <span className="block font-black text-[#0f2f6b] text-xl">Easy2Book</span>
              {t.tagline && <span className={`block text-[11px] font-bold text-blue-700 ${lang === "ar" ? "" : "uppercase tracking-[0.14em]"}`}>{t.tagline}</span>}
            </span>
          </div>
          <p className="mt-5 text-sm leading-relaxed max-w-sm">{t.intro}</p>
        </div>
        <nav aria-label={t.aria}>
          <p className={label}>{t.offers}</p>
          <ul className="space-y-1">
            {t.links.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-sm hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className={label}>{t.contact}</p>
          <ul className="space-y-1 mb-5">
            {phones.map((p) => (
              <li key={p}>
                <a href={`tel:+216${p}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-yellow-300"><PhoneIcon className="w-4 h-4 text-yellow-300" /><span dir="ltr">+216 {formatPhone(p)}</span></a>
              </li>
            ))}
            <li>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className="text-sm font-semibold text-green-300 hover:text-green-200">{t.whatsapp}</a>
            </li>
          </ul>
          <div className="flex gap-3">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="inline-flex w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white" aria-hidden="true"><path d={s.d} /></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-blue-100/60">© {new Date().getFullYear()} Easy2Book. {t.rights} · <Link href="/mentions-legales" className="underline underline-offset-2 hover:text-white">{t.legal}</Link> · <Link href="/confidentialite" className="underline underline-offset-2 hover:text-white">{t.privacy}</Link></div>
    </footer>
  )
}
