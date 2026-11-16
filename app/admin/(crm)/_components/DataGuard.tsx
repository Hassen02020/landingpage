import { sampleState } from "@/lib/intelligence"

/** « Données insuffisantes » : rappelle l'effectif, le minimum et la période. N'affiche rien si l'échantillon suffit. */
export function DataGuard({ n, min, noun, period }: { n: number; min: number; noun: string; period?: { from: string; to: string } }) {
  const s = sampleState(n, min, noun)
  if (s.enough) return null
  return (
    <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1" data-testid="data-guard" role="note">
      {s.message}
      {period ? ` Période : ${period.from} → ${period.to}.` : ""}
    </p>
  )
}
