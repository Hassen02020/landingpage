// Pages publiques d'une entreprise cliente (/o/<identifiant>) : retrouver l'entreprise par son identifiant PUBLIC, lire et enregistrer
// la configuration de son formulaire. Les lectures de configuration et d'offres se font DANS le contexte de l'organisation
// (runWithOrg / session) : db.ts leur ajoute le filtre d'organisation.
import { DbError, select, upsertQuiet } from "./db"
import { defaultFormConfig, parseFormConfig, type FormConfig } from "../form-config"

export interface PublicOrg {
  id: string
  slug: string
  name: string
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/

/** Entreprise ACTIVE d'après son identifiant public ; null si inconnue ou suspendue (aucune différence visible pour le visiteur). */
export async function loadPublicOrg(slug: string): Promise<PublicOrg | null> {
  if (!SLUG.test(slug)) return null
  try {
    const rows = await select<PublicOrg & { status: string }>("organizations", `select=id,slug,name,status&slug=eq.${slug}&status=eq.active&limit=1`)
    const o = rows[0]
    return o && o.status === "active" ? { id: o.id, slug: o.slug, name: o.name } : null
  } catch {
    return null
  }
}

/** Configuration du formulaire de l'organisation du contexte courant (défaut si aucune ou si la migration 0014 n'est pas appliquée). */
export async function loadFormConfig(): Promise<FormConfig> {
  try {
    const rows = await select<{ config: unknown }>("landing_form_configs", "select=config&limit=1")
    return rows[0] ? parseFormConfig(rows[0].config) : defaultFormConfig()
  } catch (e) {
    if (!(e instanceof DbError)) throw e
    return defaultFormConfig()
  }
}

export async function saveFormConfig(config: FormConfig, actorId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await upsertQuiet("landing_form_configs", { config, updated_at: new Date().toISOString(), updated_by: actorId }, "organization_id")
    return { ok: true }
  } catch {
    return { ok: false, error: "Enregistrement impossible (migration 0014 appliquée ?)." }
  }
}

/** Intitulés des offres VISIBLES de l'organisation du contexte courant (liste de choix du formulaire). */
export async function publicOfferNames(): Promise<string[]> {
  try {
    const rows = await select<{ name: string }>("landing_offers", "select=name&visible=eq.true&archived_at=is.null&order=position.asc,name.asc&limit=50")
    return rows.map((r) => r.name).filter(Boolean)
  } catch {
    return []
  }
}
