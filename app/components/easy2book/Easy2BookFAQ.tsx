import type { ReactNode } from "react"

export interface FaqItem { q: string; a: string }

/** Questions fréquentes (accordéon natif <details>, sans script). */
export function Easy2BookFAQ({ id = "faq", title, items, heading }: { id?: string; title: string; items: FaqItem[]; heading: (t: string) => ReactNode }) {
  return (
    <section id={id} className="max-w-3xl mx-auto px-4 py-6 scroll-mt-4">
      {heading(title)}
      <div className="space-y-2">
        {items.map((f) => (
          <details key={f.q} className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
            <summary className="font-bold cursor-pointer">{f.q}</summary>
            <p className="mt-2 text-gray-700">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
