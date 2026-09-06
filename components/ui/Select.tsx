import { cn } from "@/lib/utils"

export const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink",
      "focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20",
      className
    )}
    {...props}
  >
    {children}
  </select>
)
