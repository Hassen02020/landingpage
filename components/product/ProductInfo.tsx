import type { ProductDetailData } from "@/lib/types"

export function ProductInfo({ product }: { product: ProductDetailData }) {
  const sections = [
    { title: "Description", body: product.description },
    { title: "Ingredients", body: product.ingredients },
    { title: "Feeding Information", body: product.feedingInstructions },
  ].filter((s) => s.body)

  if (sections.length === 0) return null

  return (
    <div className="mt-12 grid gap-8 border-t border-ink-100 pt-8 sm:grid-cols-3">
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="font-display text-lg font-semibold text-ink">{section.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{section.body}</p>
        </div>
      ))}
    </div>
  )
}
