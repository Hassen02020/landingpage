import Link from "next/link"
import type { BrandCardData } from "@/lib/types"

export function BrandStrip({ brands }: { brands: BrandCardData[] }) {
  if (brands.length === 0) return null

  return (
    <section className="container py-10">
      <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Popular Brands</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/brands/${brand.slug}`}
            className="flex h-20 items-center justify-center rounded-2xl border border-ink-100 bg-white px-4 text-center text-sm font-semibold text-ink-700 transition-shadow hover:shadow-card"
          >
            {brand.name}
          </Link>
        ))}
      </div>
    </section>
  )
}
