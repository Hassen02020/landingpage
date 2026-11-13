import Link from "next/link"

export const STEPS = [
  { id: "modele", n: 1, label: "Modèle" },
  { id: "infos", n: 2, label: "Informations" },
  { id: "design", n: 3, label: "Personnaliser" },
  { id: "formulaire", n: 4, label: "Formulaire" },
  { id: "apercu", n: 5, label: "Aperçu" },
  { id: "publication", n: 6, label: "Publication" },
  { id: "stats", n: 7, label: "Statistiques" },
] as const

/** Barre de progression : les étapes 2 et 3 (informations, personnalisation) sont deux onglets du même formulaire. */
export function Stepper({ current, id, theme, saved }: { current: string; id: string; theme: string; saved: boolean }) {
  return (
    <nav aria-label="Progression" className="flex flex-wrap gap-2">
      {STEPS.map((s) => {
        const active = current === s.id
        const cls = `px-3 py-1.5 rounded-full text-sm font-bold border ${active ? "bg-violet-700 text-white border-violet-700" : saved || s.id === "infos" ? "bg-white hover:bg-gray-50" : "bg-gray-100 text-gray-400 pointer-events-none"}`
        const label = s.id === "infos" ? "2. Informations" : `${s.n}. ${s.label}`
        if (s.id === "modele") return <Link key={s.id} href="/admin/createur/modeles" className={cls}>{label}</Link>
        return <Link key={s.id} href={`/admin/createur/${id}?etape=${s.id}&theme=${theme}`} aria-current={active ? "step" : undefined} className={cls}>{label}</Link>
      })}
    </nav>
  )
}
