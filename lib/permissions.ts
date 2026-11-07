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

const ALL_ADMIN: Permission[] = [
  "org.profile.edit", "social.connect", "employees.manage", "employees.view", "site.manage", "campaigns.manage",
  "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned",
  "sales.record", "sales.record_assigned",
]

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  admin: new Set(ALL_ADMIN),
  // manager : équipes autorisées, affectation, suivi commercial, rapports ; ni profil, ni réseaux, ni site, ni gestion des comptes
  manager: new Set<Permission>(["employees.view", "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned", "sales.record", "sales.record_assigned"]),
  // employé : uniquement ce qui lui est attribué
  employee: new Set<Permission>(["leads.view_assigned", "leads.update_assigned", "sales.record_assigned"]),
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
export const roleFromLegacyStaff = (role: string): OrgRole => (role === "admin" ? "admin" : "employee")
