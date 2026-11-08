// Matrice des rôles (cahier des charges §3). Fonctions pures : la décision finale reste côté serveur
// (et dans la base, par la RLS) ; ceci décrit CE QUE chaque rôle a le droit de faire.
export type OrgRole = "admin" | "manager" | "employee"
export const ORG_ROLES: readonly OrgRole[] = ["admin", "manager", "employee"]
export const isOrgRole = (v: unknown): v is OrgRole => typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v)

export type Permission =
  | "org.profile.edit" // profil de l'entreprise
  | "social.connect" // connecter ses réseaux sociaux
  | "employees.manage" // inviter, désactiver, changer un rôle
  | "employees.view"
  | "site.manage"
  | "campaigns.manage"
  | "reports.view" // rapports de l'organisation
  | "leads.view_all"
  | "leads.view_assigned"
  | "leads.assign"
  | "leads.update" // statut, notes, interactions sur TOUS les leads de l'organisation
  | "leads.update_assigned" // idem, sur SES leads
  | "sales.record" // enregistrer une vente sur n'importe quel lead de l'organisation
  | "sales.record_assigned" // sur ses leads (selon permissions : accordé par défaut, comme aujourd'hui chez Easy2Book)
  | "catalog.manage" // offres et catégories
  | "promos.manage" // codes promo
  | "protection.manage" // blocage de numéros / IP, pays autorisés
  | "templates.manage" // modèles de messages WhatsApp
  | "data.export" // export CSV, blocage d'un numéro depuis une fiche

const ALL_ADMIN: Permission[] = [
  "org.profile.edit", "social.connect", "employees.manage", "employees.view", "site.manage", "campaigns.manage",
  "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned",
  "sales.record", "sales.record_assigned", "catalog.manage", "promos.manage", "protection.manage", "templates.manage", "data.export",
]

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  admin: new Set(ALL_ADMIN),
  // manager : équipes autorisées, affectation, suivi commercial, rapports ; ni profil, ni réseaux, ni site, ni gestion des comptes
  manager: new Set<Permission>(["employees.view", "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned", "sales.record", "sales.record_assigned"]),
  // employé : VOIT tous les leads de son entreprise (décision du propriétaire, 08/11/2026) ; ne modifie que les siens ;
  // jamais d'affectation, de rapports, de gestion d'équipe ni de réglages. Aucun accès aux leads d'une AUTRE entreprise.
  employee: new Set<Permission>(["leads.view_all", "leads.view_assigned", "leads.update_assigned", "sales.record_assigned"]),
}

export const can = (role: OrgRole | null | undefined, permission: Permission): boolean =>
  // un rôle absent OU inconnu (valeur corrompue) n'a aucun droit : on refuse, on ne plante pas
  role ? (ROLE_PERMISSIONS[role]?.has(permission) ?? false) : false

// Super Admin (plateforme) : gouvernance des organisations. JAMAIS d'accès aux leads d'une entreprise.
export type PlatformPermission = "organizations.view_all" | "organizations.suspend" | "organizations.reactivate" | "platform.audit.view" | "platform.templates.manage"
export const PLATFORM_PERMISSIONS: ReadonlySet<PlatformPermission> = new Set<PlatformPermission>([
  "organizations.view_all", "organizations.suspend", "organizations.reactivate", "platform.audit.view", "platform.templates.manage",
])
export const canPlatform = (isSuperAdmin: boolean, permission: PlatformPermission): boolean => isSuperAdmin && PLATFORM_PERMISSIONS.has(permission)

/** Correspondance avec l'équipe actuelle (landing_staff) : admin → admin, agent → employee. */
export const roleFromLegacyStaff = (role: string): OrgRole => (role === "admin" ? "admin" : role === "manager" ? "manager" : "employee")

export const ROLE_LABELS: Record<OrgRole, string> = { admin: "Administrateur", manager: "Manager", employee: "Employé" }

/**
 * Qui peut MODIFIER un lead (statut, notes, relance, vente) ? Décision du propriétaire (08/11/2026) :
 *  - administrateur et manager : tous les leads de leur entreprise ;
 *  - employé : SES leads et les leads NON affectés ; jamais ceux affectés à un collègue.
 * Voir tous les leads de son entreprise reste permis à tous les rôles ; une autre entreprise n'est jamais accessible.
 */
export function canModifyLead(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }): boolean {
  if (can(role, "leads.update")) return true
  if (!can(role, "leads.update_assigned")) return false
  return !lead.assigned_to || lead.assigned_to === userId
}

/** Affecter un lead : admin et manager à n'importe qui ; un employé seulement pour PRENDRE un lead libre (ou se l'enlever). */
export function canAssignLead(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }, target: string | null): boolean {
  if (can(role, "leads.assign")) return true
  if (!can(role, "leads.update_assigned")) return false
  if (target === userId) return !lead.assigned_to || lead.assigned_to === userId // prendre un lead libre
  return target === null && lead.assigned_to === userId // rendre SON lead
}
