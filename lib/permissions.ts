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
  | "ads.manage" // dépenses publicitaires, import et confirmation des commissions (données financières)
  | "duplicates.flag" // signaler un doublon potentiel (sur les dossiers qu'on peut modifier)
  | "duplicates.review" // confirmer ou rejeter un signalement de doublon (jamais le sien : double regard)
  | "duplicates.reopen" // rouvrir une décision de doublon (confirmée ou rejetée)
  | "ads.view" // lecture de la rentabilité publicitaire
  | "bookings.confirm_assigned" // L7b : saisir la confirmation de réservation (fournisseur, paiement) sur SES dossiers
  | "bookings.confirm" // idem sur TOUS les dossiers de l'organisation
  | "payment_terms.manage" // définir les conditions de paiement d'une offre du catalogue

const ALL_ADMIN: Permission[] = [
  "org.profile.edit", "social.connect", "employees.manage", "employees.view", "site.manage", "campaigns.manage",
  "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned",
  "sales.record", "sales.record_assigned", "catalog.manage", "promos.manage", "protection.manage", "templates.manage", "data.export",
  "ads.manage", "ads.view", "duplicates.flag", "duplicates.review", "duplicates.reopen",
  "bookings.confirm_assigned", "bookings.confirm", "payment_terms.manage",
]

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  admin: new Set(ALL_ADMIN),
  // manager : équipes autorisées, affectation, suivi commercial, rapports ; ni profil, ni réseaux, ni site, ni gestion des comptes
  manager: new Set<Permission>(["employees.view", "reports.view", "leads.view_all", "leads.view_assigned", "leads.assign", "leads.update", "leads.update_assigned", "sales.record", "sales.record_assigned", "ads.view", "duplicates.flag", "duplicates.review", "bookings.confirm_assigned", "bookings.confirm"]),
  // employé : ne voit et ne modifie que les dossiers qui lui sont ACTUELLEMENT affectés (décision Q8-A, 26/11/2026, qui remplace celle du 08/11/2026) ;
  // jamais d'affectation, de rapports, de gestion d'équipe ni de réglages. Aucun accès aux leads d'une AUTRE entreprise.
  // La restriction est appliquée côté serveur dans lib/server/db.ts (pas seulement à l'affichage).
  employee: new Set<Permission>(["leads.view_assigned", "leads.update_assigned", "sales.record_assigned", "duplicates.flag", "bookings.confirm_assigned"]),
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
 * Qui peut MODIFIER un lead (statut, notes, relance, vente) ? Décision Q8-A (26/11/2026) :
 *  - administrateur et manager : tous les leads de leur entreprise ;
 *  - employé : UNIQUEMENT les dossiers qui lui sont actuellement affectés (un dossier non affecté ou affecté à un collègue lui est invisible).
 * Une autre entreprise n'est jamais accessible.
 */
export function canModifyLead(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }): boolean {
  if (can(role, "leads.update")) return true
  if (!can(role, "leads.update_assigned")) return false
  return lead.assigned_to === userId
}

/** L7b : saisir la confirmation de réservation d'un dossier. Employé : ses dossiers seulement ; manager et administrateur : tous. */
export function canConfirmBooking(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }): boolean {
  if (can(role, "bookings.confirm")) return true
  return can(role, "bookings.confirm_assigned") && lead.assigned_to === userId
}

/** Affecter un lead : admin et manager à n'importe qui ; un employé seulement pour se DÉCHARGER de son propre dossier (il ne voit pas les dossiers libres). */
export function canAssignLead(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }, target: string | null): boolean {
  if (can(role, "leads.assign")) return true
  if (!can(role, "leads.update_assigned")) return false
  return lead.assigned_to === userId && (target === null || target === userId) // rendre SON dossier (ou le garder)
}

/** Signaler un doublon : le droit de signaler ET celui de modifier le dossier (un employé : ses dossiers uniquement). */
export function canFlagDuplicate(role: OrgRole | null | undefined, userId: string, lead: { assigned_to?: string | null }): boolean {
  return can(role, "duplicates.flag") && canModifyLead(role, userId, lead)
}

/** Confirmer ou rejeter un signalement : permission dédiée ET double regard (décision D1) : on ne décide JAMAIS son propre signalement, sans exception. */
export function canDecideDuplicate(role: OrgRole | null | undefined, userId: string, review: { reported_by: string }): boolean {
  return can(role, "duplicates.review") && review.reported_by !== userId
}

/** Rouvrir une décision (décision D2) : administrateur seulement. */
export function canReopenDuplicate(role: OrgRole | null | undefined): boolean {
  return can(role, "duplicates.reopen")
}
