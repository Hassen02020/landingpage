import { ButtonLink } from "@/components/ui/Button"
import type { PromotionData } from "@/lib/types"

export function PromoBanner({ promotions }: { promotions: PromotionData[] }) {
  if (promotions.length === 0) return null

  return (
    <section className="container py-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {promotions.slice(0, 2).map((promo) => (
          <div
            key={promo.id}
            className="flex flex-col justify-between gap-4 rounded-2xl bg-forest px-6 py-8 text-white sm:flex-row sm:items-center"
          >
            <div>
              {promo.badgeText && (
                <span className="mb-2 inline-block rounded-full bg-coral px-3 py-1 text-xs font-bold tracking-wide">
                  {promo.badgeText}
                </span>
              )}
              <h3 className="font-display text-xl font-bold sm:text-2xl">{promo.title}</h3>
              {promo.subtitle && <p className="mt-1 text-sm text-ink-100">{promo.subtitle}</p>}
            </div>
            {promo.ctaHref && promo.ctaLabel && (
              <ButtonLink href={promo.ctaHref} variant="secondary" className="shrink-0">
                {promo.ctaLabel}
              </ButtonLink>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
