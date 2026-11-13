// TABLEAU DE BORD du Créateur — logique PURE (testée) : cycle de vie, filtres, recherche, compteurs.
// Archivage SANS migration : une page archivée = catégorie MASQUÉE dont la position vaut ARCHIVED_POSITION (réversible).
// (Amélioration possible plus tard : une colonne archived_at — non créée, décision de migration séparée.)
import type { Category } from "@/lib/server/catalog"
import type { PageStatus } from "@/lib/page-status"

export const ARCHIVED_POSITION = -1000

export type Lifecycle = "brouillon" | "publiee" | "archivee"
export type View = "toutes" | Lifecycle

export const isArchived = (c: Pick<Category, "visible" | "position">): boolean => !c.visible && c.position <= ARCHIVED_POSITION
export const lifecycleOf = (c: Pick<Category, "visible" | "position">): Lifecycle => (c.visible ? "publiee" : isArchived(c) ? "archivee" : "brouillon")

export interface DashItem { category: Category; status: PageStatus; offers: number }

export interface DashQuery { vue?: string; q?: string; produit?: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export function normalizeQuery(q: DashQuery): { vue: View; q: string; produit: string } {
  const vue: View = q.vue === "brouillon" || q.vue === "publiee" || q.vue === "archivee" ? q.vue : "toutes"
  return { vue, q: (q.q ?? "").slice(0, 80), produit: ["omra", "voyage", "hotel", "autre"].includes(q.produit ?? "") ? (q.produit as string) : "" }
}

/** « Toutes » n'inclut PAS les archivées (elles ont leur propre onglet) : le quotidien reste lisible. */
export function filterPages(items: DashItem[], query: DashQuery): DashItem[] {
  const { vue, q, produit } = normalizeQuery(query)
  const needle = norm(q)
  return items.filter(({ category: c }) => {
    const life = lifecycleOf(c)
    if (vue === "toutes" ? life === "archivee" : life !== vue) return false
    if (produit && c.product !== produit) return false
    if (needle && !norm(`${c.name} ${c.slug} ${c.headline ?? ""}`).includes(needle)) return false
    return true
  })
}

export interface DashSummary { total: number; brouillons: number; publiees: number; archivees: number; aCorriger: number }

/** « À corriger » = page publiée dont le lien ne peut pas recevoir de publicité (offres expirées, sans offre…). */
export function summarize(items: DashItem[]): DashSummary {
  const s: DashSummary = { total: 0, brouillons: 0, publiees: 0, archivees: 0, aCorriger: 0 }
  for (const { category: c, status } of items) {
    const life = lifecycleOf(c)
    if (life === "archivee") { s.archivees++; continue }
    s.total++
    if (life === "brouillon") s.brouillons++
    else { s.publiees++; if (!status.ok) s.aCorriger++ }
  }
  return s
}

/** Adresse proposée pour une copie : « -copie », puis « -copie-2 »… (60 caractères maximum, jamais déjà utilisée). */
export function copySlug(slug: string, taken: string[]): string {
  const used = new Set(taken)
  for (let n = 1; n < 100; n++) {
    const suffix = n === 1 ? "-copie" : `-copie-${n}`
    const candidate = `${slug.slice(0, 60 - suffix.length).replace(/-+$/, "")}${suffix}`
    if (!used.has(candidate)) return candidate
  }
  return `${slug.slice(0, 50)}-${Date.now().toString(36)}`.slice(0, 60)
}
