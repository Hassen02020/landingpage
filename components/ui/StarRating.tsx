import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function StarRating({
  rating,
  count,
  size = 14,
  className,
}: {
  rating: number
  count?: number
  size?: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={size}
            className={i < Math.round(rating) ? "fill-gold text-gold" : "fill-ink-100 text-ink-100"}
          />
        ))}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-ink-400">({count})</span>
      )}
    </div>
  )
}
