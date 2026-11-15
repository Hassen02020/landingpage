import type { MouseEvent, ReactNode } from "react"
import { Easy2BookButton } from "./Easy2BookButton"

/** Appel WhatsApp : le suivi (clic, consentement) reste fourni par la page via `onClick` ; ce composant ne suit rien lui-même. */
export function Easy2BookWhatsAppCTA({ href, onClick, className = "", children, ariaLabel }: { href: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; className?: string; children: ReactNode; ariaLabel?: string }) {
  return <Easy2BookButton href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} variant="whatsapp" className={className} aria-label={ariaLabel}>{children}</Easy2BookButton>
}
