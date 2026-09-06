import Image from "next/image"
import Link from "next/link"
import type { CategoryCardData } from "@/lib/types"

export function CategoryGrid({ categories }: { categories: CategoryCardData[] }) {
  if (categories.length === 0) return null

  return (
    <section className="container py-10">
      <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Shop by Category</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-center transition-shadow hover:shadow-card"
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-sand-100 sm:h-24 sm:w-24">
              {cat.imageUrl && (
                <Image
                  src={cat.imageUrl}
                  alt={cat.name}
                  fill
                  sizes="96px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              )}
            </div>
            <span className="text-sm font-medium text-ink-700">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
