"use client"

import Image from "next/image"
import Link from "next/link"
import type { MouseEvent } from "react"
import { PHONE_NUMBER } from "@/lib/config"
import { PhoneIcon, formatPhone } from "./SiteHeader"

const SOCIAL = [
  { href: "https://www.facebook.com/Easy2Bookplateforme", label: "Facebook", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { href: "https://www.instagram.com/easy2book.2025/", label: "Instagram", d: "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z" },
  { href: "https://www.tiktok.com/@easy2book", label: "TikTok", d: "M19.6 6.7a4.8 4.8 0 0 1-3-1.6A4.8 4.8 0 0 1 15.4 2h-3.3v13.4a2.9 2.9 0 1 1-2-2.8V9.2a6.2 6.2 0 1 0 5.3 6.2V8.6a8 8 0 0 0 4.7 1.5V6.8z" },
]

const LINKS = [
  { href: "/voyages-organises", label: "Voyages organisés" },
  { href: "/omra", label: "Omra" },
  { href: "/summer-vibes", label: "Promos hôtels" },
]

/** Pied de page commun : logo mis en valeur sur fond clair, liens, contact et réseaux. */
export function SiteFooter({ whatsappHref, onWhatsApp, extraPhones = [] }: { whatsappHref: string; onWhatsApp?: (e: MouseEvent<HTMLAnchorElement>) => void; extraPhones?: string[] }) {
  const phones = [PHONE_NUMBER, ...extraPhones]
  return (
    <footer className="bg-[#071e3d] text-blue-100/80">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl p-3 pr-6 shadow-lg">
            <Image src="/logo.png" alt="Easy2Book, centrale de réservation" width={72} height={72} className="w-[72px] h-[72px] object-contain" />
            <span className="leading-tight">
              <span className="block font-black text-[#0f2f6b] text-xl">Easy2Book</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Centrale de réservation</span>
            </span>
          </div>
          <p className="mt-5 text-sm leading-relaxed max-w-sm">Voyages organisés, Omra et promos hôtels en Tunisie. Devis gratuit et réservation sur WhatsApp.</p>
        </div>
        <nav aria-label="Pied de page">
          <p className="text-white font-extrabold text-sm uppercase tracking-widest mb-4">Nos offres</p>
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-sm hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-white font-extrabold text-sm uppercase tracking-widest mb-4">Contact</p>
          <ul className="space-y-1 mb-5">
            {phones.map((p) => (
              <li key={p}>
                <a href={`tel:+216${p}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-yellow-300"><PhoneIcon className="w-4 h-4 text-yellow-300" />+216 {formatPhone(p)}</a>
              </li>
            ))}
            <li>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className="text-sm font-semibold text-green-300 hover:text-green-200">Écrire sur WhatsApp</a>
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
      <div className="border-t border-white/10 py-5 text-center text-xs text-blue-100/60">© {new Date().getFullYear()} Easy2Book. Tous droits réservés.</div>
    </footer>
  )
}
