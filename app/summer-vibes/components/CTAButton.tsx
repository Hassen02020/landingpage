"use client"

const WHATSAPP_NUMBER = "21698140514"
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Bonjour Easy2Book, je souhaite avoir le tarif pour Summer Vibes 2026 ! 🏖️\n\nMerci de me préciser :\n📅 Date du congés\n👥 Nombre d'adultes\n👶 Âges des enfants\n📍 Zone : Hammamet / Monastir / Sousse / Tabarka / Mahdia / Djerba"
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

interface CTAButtonProps {
  label: string
  className?: string
  style?: React.CSSProperties
  location?: string
  onCtaClick?: (location: string) => void
}

export function CTAButton({ label, className, style, location, onCtaClick }: CTAButtonProps) {
  const handleClick = () => {
    onCtaClick?.(location || "general")
  }

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
      style={style}
    >
      {label}
    </a>
  )
}
