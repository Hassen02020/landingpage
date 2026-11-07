// Contexte d'organisation côté serveur. Règle (décision du 07/11/2026) : tout accès aux données d'une
// entreprise est restreint par organization_id, VÉRIFIÉ ICI côté serveur ; service_role ne sert jamais
// de raccourci pour contourner cette vérification.
import { DbError, select } from "./db"
import { isOrgRole, roleFromLegacyStaff, type OrgRole } from "@/lib/permissions"

/** Organisation n°1 (Easy2Book). Valeur par défaut TRANSITOIRE des colonnes organization_id (migration 0008). */
export const DEFAULT_ORG_ID = "00000000-0000-4000-8000-0000000e2b01"
export const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class TenantError extends Error {}

export const isOrgId = (v: unknown): v is string => typeof v === "string" && ORG_ID_RE.test(v)

/** Filtre PostgREST `organization_id=eq.<uuid>` ; refuse tout identifiant mal formé (aucune valeur libre dans la requête). */
export function orgFilter(orgId: string): string {
  if (!isOrgId(orgId)) throw new TenantError("identifiant d'organisation invalide")
  return `organization_id=eq.${orgId}`
}

/** Ajoute le filtre d'organisation à une requête PostgREST (query string sans « ? »). */
export function scoped(query: string, orgId: string): string {
  return query ? `${query}&${orgFilter(orgId)}` : orgFilter(orgId)
}

/** Une ligne lue doit appartenir à l'organisation attendue (défense en profondeur après une lecture par identifiant). */
export function assertSameOrg(row: { organization_id?: string | null } | null | undefined, orgId: string): void {
  if (!row || row.organization_id !== orgId) throw new TenantError("ressource d'une autre organisation")
}

export interface Membership {
  organizationId: string
  role: OrgRole
  source: "members" | "legacy_staff"
}

const isMissingTable = (e: unknown) => e instanceof DbError && (e.status === 404 || e.code === "42P01" || e.code === "PGRST205")

/**
 * Organisation et rôle d'un compte.
 *  - table organization_members présente : source de vérité (aucune ligne → pas de membre → null) ;
 *  - table ABSENTE (migration 0008 non appliquée) : repli sur l'équipe actuelle (Easy2Book), pour que le CRM
 *    existant ne casse pas pendant la transition.
 */
export async function resolveMembership(userId: string, legacyRole?: string): Promise<Membership | null> {
  if (!isOrgId(userId)) return null // un user_id est un UUID ; toute autre valeur est refusée avant la requête
  try {
    const rows = await select<{ organization_id: string; role: string }>(
      "organization_members",
      `select=organization_id,role&user_id=eq.${userId}&active=eq.true&limit=2`
    )
    const m = rows.find((r) => isOrgRole(r.role))
    return m ? { organizationId: m.organization_id, role: m.role as OrgRole, source: "members" } : null
  } catch (e) {
    if (isMissingTable(e) && legacyRole) return { organizationId: DEFAULT_ORG_ID, role: roleFromLegacyStaff(legacyRole), source: "legacy_staff" }
    throw e
  }
}

/** Administrateur de la plateforme ? Table absente → faux (jamais de Super Admin par défaut). */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  if (!isOrgId(userId)) return false
  try {
    const rows = await select<{ user_id: string }>("platform_admins", `select=user_id&user_id=eq.${userId}&limit=1`)
    return rows.length === 1
  } catch (e) {
    if (isMissingTable(e)) return false
    throw e
  }
}
