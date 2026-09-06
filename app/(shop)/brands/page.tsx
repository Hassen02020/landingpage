import Link from "next/link"
import type { Metadata } from "next"
import { getBrands } from "@/lib/data/catalog"

export const metadata: Metadata = { title: "Brands", description: "Shop pet food and supply brands carried by PETORA." }

export default async function BrandsPage() {
  const brands = await getBrands(100)

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Popular Brands</h1>
      {brands.length === 0 ? (
        <p className="mt-10 text-sm text-ink-500">No brands available yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="flex h-24 items-center justify-center rounded-2xl border border-ink-100 bg-white px-4 text-center text-sm font-semibold text-ink-700 transition-shadow hover:shadow-card"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
