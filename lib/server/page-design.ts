// Lecture / écriture de la personnalisation d'une page (colonne `design` JSONB de landing_categories, migration PROPOSÉE 0018 : voir
// supabase/migrations/0018_page_design.sql — fichier local, NON appliqué). TANT QUE LA COLONNE N'EXISTE PAS : lecture = « indisponible » (la page
// publique garde son rendu actuel), écriture = message clair ; jamais d'erreur 500 ni de perte de données.
import { DbError, select, update } from "@/lib/server/db"
import { familyOf } from "@/lib/page-builder/themes"
import { defaultDesign, sanitizeDesign, type DesignErrors, type PageDesign } from "@/lib/page-builder/design"
import type { Product } from "@/lib/config"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** colonne absente (PostgreSQL 42703) ou schéma non à jour */
export const isMissingColumn = (e: unknown): boolean => e instanceof DbError && (e.code === "42703" || e.code === "PGRST204" || (e.status === 400 && /design/i.test(e.message)))

export interface LoadedDesign { available: boolean; design: PageDesign; stored: boolean }

export async function loadDesign(id: string, product: Product): Promise<LoadedDesign> {
  const family = familyOf(product)
  if (!UUID.test(id)) return { available: false, design: defaultDesign(family), stored: false }
  try {
    const [row] = await select<{ design: unknown }>("landing_categories", `select=design&id=eq.${id}&limit=1`)
    const raw = row?.design ?? null
    return { available: true, design: sanitizeDesign(raw, family).design, stored: raw !== null }
  } catch (e) {
    if (isMissingColumn(e)) return { available: false, design: defaultDesign(family), stored: false }
    throw e
  }
}

/** Version PUBLIQUE (page /p) : jamais d'exception — sans colonne, sans design ou en cas de panne, la page garde son rendu par défaut. */
export async function publicDesign(slug: string, product: Product): Promise<PageDesign | null> {
  try {
    const [row] = await select<{ design: unknown }>("landing_categories", `select=design&slug=eq.${encodeURIComponent(slug)}&visible=eq.true&limit=1`)
    if (!row || row.design === null || row.design === undefined) return null
    return sanitizeDesign(row.design, familyOf(product)).design
  } catch { return null }
}

export type SaveDesignResult = { ok: true } | { ok: false; message: string; errors: DesignErrors }

export async function saveDesign(id: string, product: Product, raw: unknown, actorId: string | null): Promise<SaveDesignResult> {
  if (!UUID.test(id)) return { ok: false, message: "Page introuvable.", errors: {} }
  const { design, errors } = sanitizeDesign(raw, familyOf(product))
  if (Object.keys(errors).length) return { ok: false, message: "Vérifiez les champs signalés.", errors }
  try {
    await update("landing_categories", `id=eq.${id}`, { design, updated_at: new Date().toISOString(), updated_by: actorId })
    return { ok: true }
  } catch (e) {
    if (isMissingColumn(e)) return { ok: false, message: "La personnalisation avancée nécessite la migration 0018 (fichier prêt, à appliquer par le propriétaire) : rien n'a été enregistré.", errors: {} }
    throw e
  }
}
