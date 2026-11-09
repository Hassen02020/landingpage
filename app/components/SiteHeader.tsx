"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { PHONE_NUMBER } from "@/lib/config"

export const formatPhone = (n: string) => n.replace(/(\d{2})(\d{3})(\d{3})/, "$1 $2 $3")

export function PhoneIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  )
}

const NAV = [
  { href: "/voyages-organises", label: "Voyages organisés" },
  { href: "/omra", label: "Omra" },
  { href: "/summer-vibes", label: "Promos hôtels" },
]

/** En-tête commun : logo bien visible, navigation, téléphone lisible et bouton WhatsApp (passé en `cta`, chaque page garde son suivi). */
export function SiteHeader({ cta, fixed = false, current }: { cta: ReactNode; fixed?: boolean; current?: string }) {
  return (
    <header className={`${fixed ? "fixed inset-x-0" : "sticky"} top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm`}>
      <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image src="/logo.png" alt="" width={56} height={56} priority className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
          <span className="leading-tight">
            <span className="block font-black text-gray-900 text-base sm:text-lg tracking-tight">Easy2Book</span>
            <span className="hidden sm:block text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Centrale de réservation</span>
          </span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${current === n.href ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-100"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href={`tel:+216${PHONE_NUMBER}`} className="hidden md:inline-flex items-center gap-2 text-sm font-extrabold text-gray-800 hover:text-blue-700">
            <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-blue-50 text-blue-700"><PhoneIcon /></span>
            {formatPhone(PHONE_NUMBER)}
          </a>
          {cta}
        </div>
      </div>
    </header>
  )
}

export function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a12 12 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.3zM12 21.7a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.9 9.9 0 0 1-1.5-5.1C2.1 6.4 6.5 2 12 2c2.6 0 5.1 1 7 2.9a9.8 9.8 0 0 1 2.9 7c0 5.4-4.4 9.8-9.9 9.8zm5.4-7.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-1 1.2c-.2.2-.4.2-.7.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.8 2.5.8 3.4.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" />
    </svg>
  )
}
