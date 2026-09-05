import Link from "next/link"
import { cn } from "@/lib/utils"

type ButtonBaseProps = {
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  className?: string
  children: React.ReactNode
}

const variants: Record<NonNullable<ButtonBaseProps["variant"]>, string> = {
  primary: "bg-forest text-white hover:bg-forest-700 active:bg-forest-800",
  secondary: "bg-coral text-white hover:bg-coral-600 active:bg-coral-700",
  outline: "border border-ink-200 text-ink bg-white hover:bg-ink-50",
  ghost: "text-ink hover:bg-ink-50",
}

const sizes: Record<NonNullable<ButtonBaseProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonBaseProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  )
}
