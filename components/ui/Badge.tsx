import { cn } from "@/lib/utils"

const variants = {
  coral: "bg-coral text-white",
  forest: "bg-forest text-white",
  gold: "bg-gold text-white",
  sand: "bg-sand-300 text-ink-700",
  outline: "border border-ink-200 text-ink-600",
}

export function Badge({
  variant = "sand",
  className,
  children,
}: {
  variant?: keyof typeof variants
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
