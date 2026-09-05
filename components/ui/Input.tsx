import { cn } from "@/lib/utils"

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink placeholder:text-ink-400",
      "focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20",
      className
    )}
    {...props}
  />
)

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-sm font-medium text-ink-700", className)} {...props} />
)
