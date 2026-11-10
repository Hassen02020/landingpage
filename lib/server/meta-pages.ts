// Pages Facebook rattachées à une entreprise (table landing_meta_pages, migration 0015).
// La table n'est pas filtrée automatiquement par organisation (le webhook doit retrouver l'entreprise d'une page) :
// TOUT accès d'administration d'ici filtre explicitement par entreprise ; le jeton n'est jamais renvoyé, seulement ses 4 derniers caractères.
import { DbError, insertOne, select, update } from "@/lib/server/db"
import { seal } from "@/lib/server/secret-box"
import { isOrgId } from "@/lib/org-id"

export interface MetaPageView { page_id: string; page_name: string | null; enabled: boolean; consent_confirmed: boolean; token_last4: string; updated_at: string }
export interface MetaPageInput { pageId: string; pageName?: string; token?: string; enabled: boolean; consentConfirmed: boolean }
export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string>; message?: string }

const PAGE_ID = /^\d{5,25}$/
const PAGE_TOKEN = /^EAA[A-Za-z0-9]{40,600}$/

export async function listMetaPages(orgId: string): Promise<{ pages: MetaPageView[]; migrationApplied: boolean }> {
  if (!isOrgId(orgId)) return { pages: [], migrationApplied: true }
  try {
    const rows = await select<MetaPageView>("landing_meta_pages", `select=page_id,page_name,enabled,consent_confirmed,token_last4,updated_at&organization_id=eq.${orgId}&order=created_at.asc`)
    // liste blanche explicite : ce tableau part vers le navigateur, le jeton chiffré n'y figure jamais, quoi que renvoie la base
    const pages: MetaPageView[] = rows.map((r) => ({ page_id: r.page_id, page_name: r.page_name ?? null, enabled: Boolean(r.enabled), consent_confirmed: Boolean(r.consent_confirmed), token_last4: r.token_last4, updated_at: r.updated_at }))
    return { pages, migrationApplied: true }
  } catch (e) {
    if (e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)) return { pages: [], migrationApplied: false }
    return { pages: [], migrationApplied: true }
  }
}

export async function saveMetaPage(orgId: string, actorId: string | null, input: MetaPageInput): Promise<SaveResult> {
  if (!isOrgId(orgId)) return { ok: false, errors: {}, message: "Entreprise inconnue." }
  const errors: Record<string, string> = {}
  const pageId = String(input.pageId ?? "").trim()
  if (!PAGE_ID.test(pageId)) errors.pageId = "Identifiant de page : 5 à 25 chiffres (Meta Business > Pages)."
  const name = String(input.pageName ?? "").trim().slice(0, 200)
  const token = String(input.token ?? "").trim()
  if (token && !PAGE_TOKEN.test(token)) errors.token = "Jeton de Page : commence par « EAA », lettres et chiffres, sans espace."
  if (Object.keys(errors).length) return { ok: false, errors }
  if (input.enabled && !input.consentConfirmed) {
    return { ok: false, errors: { consentConfirmed: "Pour activer la page, confirmez que le formulaire demande l'accord d'être recontacté." } }
  }

  try {
    const existing = await select<{ organization_id: string }>("landing_meta_pages", `select=organization_id&page_id=eq.${pageId}&limit=1`)
    if (existing[0] && existing[0].organization_id !== orgId) {
      return { ok: false, errors: { pageId: "Cette page est déjà rattachée à une autre entreprise." } }
    }
    const common = { page_name: name || null, enabled: input.enabled, consent_confirmed: input.consentConfirmed, updated_at: new Date().toISOString(), updated_by: actorId }
    if (existing[0]) {
      const patch: Record<string, unknown> = { ...common }
      if (token) Object.assign(patch, { token_ciphertext: seal(token), token_last4: token.slice(-4) })
      await update("landing_meta_pages", `page_id=eq.${pageId}&organization_id=eq.${orgId}`, patch)
    } else {
      if (!token) return { ok: false, errors: { token: "Jeton de Page requis pour une nouvelle page." } }
      await insertOne("landing_meta_pages", { page_id: pageId, organization_id: orgId, ...common, token_ciphertext: seal(token), token_last4: token.slice(-4) })
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof DbError && e.isUniqueViolation) return { ok: false, errors: { pageId: "Cette page est déjà rattachée à une autre entreprise." } }
    if (e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)) return { ok: false, errors: {}, message: "La migration 0015 n'est pas encore appliquée dans Supabase." }
    console.error("[meta-pages] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}
