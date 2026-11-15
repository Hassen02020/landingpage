export interface ConditionItem { title: string; text: string }

/** Bandeau « avantages et conditions » : texte d'information validé par l'équipe, jamais un calcul. 1 à 3 blocs sur une ligne, davantage sur deux ou trois colonnes. */
export function Easy2BookConditionsBand({ id = "conditions", ariaLabel, items, bandClass, titleClass }: { id?: string; ariaLabel: string; items: ConditionItem[]; bandClass: string; titleClass: string }) {
  const n = items.length
  const cols = n === 1 ? "md:grid-cols-1" : n === 2 || n === 4 ? "md:grid-cols-2" : n === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"
  return (
    <section id={id} className="max-w-5xl mx-auto px-4 py-6" aria-label={ariaLabel} data-testid="conditions">
      <div className={`rounded-2xl p-6 grid gap-5 ${cols} ${bandClass}`}>
        {items.map((x, i) => (
          <div key={x.title + i}>
            <p className={`text-xs font-black ${titleClass}`}>{x.title}</p>
            <p className="mt-1 text-sm font-bold text-gray-900 whitespace-pre-line">{x.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
