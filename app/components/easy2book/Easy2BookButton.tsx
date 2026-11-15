import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react"

// Bouton Easy2Book. Couleurs de marque uniquement (variables --e2b-*) ; « page » laisse la page imposer sa couleur d'action (classe passée).
export type ButtonVariant = "brand" | "whatsapp" | "page"
const VARIANT: Record<ButtonVariant, string> = {
  brand: "text-white bg-e2b-blue hover:bg-e2b-blue-dark",
  whatsapp: "text-white bg-e2b-wa hover:bg-e2b-wa-dark",
  page: "text-white",
}

type Common = { variant?: ButtonVariant; className?: string; children: ReactNode }
export function Easy2BookButton(props: Common & ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement> | { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)) {
  const { variant = "brand", className = "", children, ...rest } = props as Common & Record<string, unknown>
  const cls = `${VARIANT[variant]} ${className}`.trim()
  if (typeof (rest as { href?: string }).href === "string") return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={cls}>{children}</a>
  return <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={cls}>{children}</button>
}
