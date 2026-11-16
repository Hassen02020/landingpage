import Image from "next/image"
import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"
import { PhoneText } from "@/lib/design-system/bidi"

export interface HeaderNavItem { href: string; label: string }

/** En-tête compact Easy2Book : logo, menu d'ancres, téléphone/WhatsApp, bouton de réservation. Textes et liens viennent de la page (aucun suivi ici). */
export function Easy2BookHeader({ name, nav, phoneLabel, whatsappHref, onWhatsApp, cta, homeHref = "/" }: { name: string; nav: HeaderNavItem[]; phoneLabel: string; whatsappHref: string; onWhatsApp?: (e: MouseEvent<HTMLAnchorElement>) => void; cta: ReactNode; homeHref?: string }) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b-2 border-e2b-yellow" data-testid="brochure-header">
      <div className="max-w-6xl mx-auto px-4 h-[76px] sm:h-[92px] flex items-center justify-between gap-3">
        <Link href={homeHref} className="flex items-center gap-3 min-w-0">
          <Image src="/logo.png" alt="Easy2Book" width={96} height={96} priority className="w-16 h-16 sm:w-[84px] sm:h-[84px] object-contain" />
          <span className="leading-tight min-w-0">
            <span className="block font-black text-e2b-blue text-xl sm:text-2xl tracking-tight">Easy2Book</span>
            <span className="block text-xs sm:text-sm font-bold text-e2b-ink/70 truncate max-w-[9rem] sm:max-w-xs">{name}</span>
          </span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6 text-sm font-semibold text-e2b-ink/80">
          {nav.map((n) => <a key={n.href} href={n.href} className="hover:text-e2b-blue">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-e2b-wa bg-white px-3 py-2 text-sm font-extrabold text-e2b-wa" aria-label="WhatsApp">
            <PhoneText>{phoneLabel}</PhoneText><span aria-hidden="true">💬</span>
          </a>
          {cta}
        </div>
      </div>
    </header>
  )
}
