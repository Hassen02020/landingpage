// Briques d'interface partagées de l'espace équipe (LOT 1 — design system CRM).
// Affichage SEUL : aucune lecture de données, aucun droit, aucune règle métier. Valeurs et libellés viennent des pages,
// qui ne reçoivent que les données que le serveur leur autorise (aucun masquage par CSS).
// Couleurs : échelle brand-* (= bleu Easy2Book, variables --e2b-*) et couleurs d'état (ambre, vert, rouge, gris).
import Link from "next/link"
import { STATUS_LABELS, isStatus } from "@/lib/status"
import { PHASE_LABELS, STATUS_COLORS, statusPhase } from "../../format"

/** Badge de statut du pipeline : libellé officiel + point, couleur par phase ; la phase est aussi lue par les lecteurs d'écran. */
export function StatusBadge({ status }: { status: string }) {
  const label = isStatus(status) ? STATUS_LABELS[status] : status
  const phase = statusPhase(status)
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
      title={`Phase : ${PHASE_LABELS[phase]}`}
      data-phase={phase}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
      <span className="sr-only"> (phase : {PHASE_LABELS[phase]})</span>
    </span>
  )
}

/** En-tête de page : titre, description courte facultative, actions (passent sous le titre sur mobile). */
export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export type Tone = "neutral" | "brand" | "attention" | "danger" | "success"
const TONE_TEXT: Record<Tone, string> = { neutral: "text-gray-900", brand: "text-brand-700", attention: "text-amber-700", danger: "text-red-700", success: "text-green-700" }
const TONE_BAR: Record<Tone, string> = { neutral: "bg-gray-300", brand: "bg-brand-600", attention: "bg-amber-500", danger: "bg-red-600", success: "bg-green-600" }

/** Indicateur (cliquable si href) : la valeur est fournie par la page, jamais calculée ici ; filet de couleur + libellé. */
export function KpiCard({ href, value, label, hint, tone = "neutral" }: { href?: string; value: React.ReactNode; label: string; hint?: string; tone?: Tone }) {
  const body = (
    <>
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r ${TONE_BAR[tone]}`} aria-hidden="true" />
      <span className={`block text-2xl font-black tabular-nums ${TONE_TEXT[tone]}`}>{value}</span>
      <span className="block text-sm font-semibold text-gray-700">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-gray-600">{hint}</span>}
    </>
  )
  const cls = "relative block rounded-2xl border border-gray-200 bg-white p-4 pl-5 shadow-sm"
  return href ? <Link href={href} className={`${cls} transition hover:border-brand-300 hover:shadow-md`}>{body}</Link> : <div className={cls}>{body}</div>
}

/** Puce de filtre (lien) : état actif annoncé par aria-current. */
export function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-[36px] items-center rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-brand-300 hover:bg-brand-50"}`}
    >
      {label}
    </Link>
  )
}

/** Message d'état : information / succès / avertissement (role=status) ou erreur (role=alert). */
export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const cls = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  }[tone]
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2.5 text-sm ${cls}`}>{children}</div>
}

/** État vide explicite (après un chargement réussi) : jamais un zéro trompeur ni une donnée inventée. Erreur de chargement : LoadError. */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center" data-testid="empty-state">
      <p className="font-bold text-gray-900">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-gray-600">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Squelette de chargement (aria-busy) : formes neutres, aucun chiffre. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-4" data-testid="admin-loading">
      <span className="sr-only">Chargement…</span>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/80" />)}
      </div>
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />)}
      </div>
    </div>
  )
}

/** Classes partagées des champs et boutons (zones cliquables ≥ 40 px, focus visible hérité de .admin-root). */
export const fieldCls = "min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
export const primaryBtnCls = "inline-flex min-h-[40px] items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
export const secondaryBtnCls = "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
