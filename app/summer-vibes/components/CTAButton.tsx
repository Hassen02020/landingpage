"use client"

import { WHATSAPP_NUMBER } from "@/lib/config"
import { handleWhatsAppClick } from "@/lib/tracking"
import { waText } from "@/lib/wa-text"

const WHATSAPP_MESSAGE = encodeURIComponent(waText(
  "Bonjour Easy2Book, je souhaite avoir le tarif pour la promo du mois !\n\nMerci de me préciser :\n- Date du congés\n- Nombre d'adultes\n- Âges des enfants\n- Zone : Hammamet / Monastir / Sousse / Tabarka / Mahdia / Djerba"
))
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

interface CTAButtonProps {
  label: string
  className?: string
  style?: React.CSSProperties
  location?: string
}

export function CTAButton({ label, className, style, location }: CTAButtonProps) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => handleWhatsAppClick(e, { product: "hotel", location: location || "general" })}
      className={className}
      style={style}
    >
      {label}
    </a>
  )
}
