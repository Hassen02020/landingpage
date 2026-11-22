// Menu de l'espace équipe : définition PURE (testée), sans React. Les droits par entrée sont ceux des pages elles-mêmes.
import type { OrgRole, Permission } from "@/lib/permissions"
import { can } from "@/lib/permissions"

export type IconName = "leads" | "pipeline" | "clock" | "plus" | "chart" | "calc" | "box" | "ticket" | "shield" | "plug" | "link" | "team" | "chat" | "download" | "user"

export interface NavItem {
  href: string
  label: string
  icon: IconName
  permission?: Permission // absent : visible par tous les rôles
  plain?: boolean // lien « normal » (téléchargement) au lieu de <Link>
  match?: (path: string, params: URLSearchParams) => boolean
}
export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Leads",
    items: [
      { href: "/admin", label: "Leads", icon: "leads", match: (p, q) => (p === "/admin" && q.get("followUp") !== "due") || (p.startsWith("/admin/leads/") && p !== "/admin/leads/new") },
      { href: "/admin/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/admin/conversations", label: "Conversations", icon: "chat", permission: "leads.view_all" },
      { href: "/admin/clients", label: "Clients", icon: "team" },
      { href: "/admin?followUp=due", label: "Relances", icon: "clock", match: (p, q) => p === "/admin" && q.get("followUp") === "due" },
      { href: "/admin/leads/new", label: "Nouveau lead", icon: "plus" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/admin/intelligence", label: "Vue d'ensemble", icon: "chart", permission: "reports.view", match: (p) => p === "/admin/intelligence" },
      { href: "/admin/intelligence/dirigeant", label: "Tableau dirigeant", icon: "chart", permission: "reports.view" },
      { href: "/admin/stats", label: "Statistiques", icon: "chart" },
      { href: "/admin/segments", label: "Segments", icon: "team" },
      { href: "/admin/rentabilite", label: "Rentabilité", icon: "chart", permission: "ads.view" },
      { href: "/admin/liens", label: "Liens de campagne", icon: "link" },
      { href: "/admin/intelligence/qualite", label: "Qualité des données", icon: "shield", permission: "reports.view" },
      { href: "/admin/calculateur", label: "Calculateur", icon: "calc" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/createur", label: "Créateur de Landing Pages", icon: "plus", permission: "catalog.manage" },
      { href: "/admin/catalogue", label: "Offres et catégories", icon: "box", permission: "catalog.manage" },
      { href: "/admin/promos", label: "Codes promo", icon: "ticket", permission: "promos.manage" },
      { href: "/admin/avis", label: "Avis des visiteurs", icon: "chat", permission: "catalog.manage" },
    ],
  },
  {
    title: "Réglages",
    items: [
      { href: "/admin/canaux", label: "Canaux", icon: "plug", permission: "reports.view" },
      { href: "/admin/integrations", label: "Intégrations", icon: "plug", permission: "social.connect" },
      { href: "/admin/formulaire", label: "Formulaire", icon: "chat", permission: "site.manage" },
      { href: "/admin/protection", label: "Protection", icon: "shield", permission: "protection.manage" },
      { href: "/admin/equipe", label: "Équipe", icon: "team", permission: "employees.view" },
      { href: "/admin/modeles", label: "Modèles WhatsApp", icon: "chat", permission: "templates.manage" },
      { href: "/admin/export", label: "Export CSV", icon: "download", plain: true, permission: "data.export" },
    ],
  },
]


/** Groupes et entrées visibles pour un rôle (un groupe sans entrée visible disparaît). */
export function visibleGroups(role: OrgRole | null | undefined): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || can(role, it.permission)) })).filter((g) => g.items.length > 0)
}
