import type { Readiness } from "@/lib/page-builder/readiness"

export function ReadinessList({ r }: { r: Readiness }) {
  const groups = [
    { title: "À corriger avant de publier", items: r.checks.filter((c) => c.level === "bloquant") },
    { title: "Pour une page plus convaincante", items: r.checks.filter((c) => c.level === "avertissement") },
  ]
  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-3 text-sm font-bold ${r.ready ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`} role="status" data-ready={r.ready}>
        {r.ready ? `Page prête à publier${r.warnings ? ` — ${r.warnings} amélioration${r.warnings > 1 ? "s" : ""} conseillée${r.warnings > 1 ? "s" : ""}` : ""}.` : `Page incomplète : ${r.blocking} point${r.blocking > 1 ? "s" : ""} à corriger avant publication.`}
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="text-sm font-black mb-2">{g.title}</h3>
          <ul className="space-y-1.5">
            {g.items.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm" data-check={c.id} data-ok={c.ok}>
                <span aria-hidden="true" className={c.ok ? "text-green-600" : g.title.startsWith("À") ? "text-red-600" : "text-amber-600"}>{c.ok ? "✓" : g.title.startsWith("À") ? "✗" : "!"}</span>
                <span><span className="font-semibold">{c.label}</span>{!c.ok && c.detail ? <span className="text-gray-600"> — {c.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
