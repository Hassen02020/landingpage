import { describe, expect, it } from "vitest"
import { can, canAssignLead, canModifyLead, roleFromLegacyStaff, ROLE_LABELS, type OrgRole, type Permission } from "@/lib/permissions"

const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const own = { assigned_to: ME }, theirs = { assigned_to: OTHER }, free = { assigned_to: null }

describe("matrice des rôles (chantier 06)", () => {
  const ADMIN_ONLY: Permission[] = ["catalog.manage", "promos.manage", "protection.manage", "templates.manage", "data.export", "social.connect", "employees.manage", "org.profile.edit", "site.manage", "campaigns.manage"]
  it.each(ADMIN_ONLY)("%s : administrateur seulement", (p) => {
    expect(can("admin", p)).toBe(true)
    expect(can("manager", p)).toBe(false)
    expect(can("employee", p)).toBe(false)
  })
  it("le manager voit l'équipe, affecte, suit les ventes et les rapports ; l'employé n'a ni équipe ni affectation générale", () => {
    for (const p of ["employees.view", "leads.assign", "leads.update", "sales.record", "reports.view"] as Permission[]) {
      expect(can("manager", p), p).toBe(true)
      expect(can("employee", p), p).toBe(false)
    }
  })
  it("tous les rôles voient tous les leads de leur entreprise ; un rôle absent ou inconnu n'a aucun droit", () => {
    for (const r of ["admin", "manager", "employee"] as OrgRole[]) expect(can(r, "leads.view_all")).toBe(true)
    expect(can(null, "leads.view_all")).toBe(false)
    expect(can("root" as OrgRole, "leads.view_all")).toBe(false)
  })
  it("correspondance avec l'équipe : admin, manager, agent → admin, manager, employé", () => {
    expect([roleFromLegacyStaff("admin"), roleFromLegacyStaff("manager"), roleFromLegacyStaff("agent"), roleFromLegacyStaff("?")]).toEqual(["admin", "manager", "employee", "employee"])
    expect(ROLE_LABELS.manager).toBe("Manager")
  })
})

describe("qui modifie un lead", () => {
  it("administrateur et manager : tous les leads", () => {
    for (const r of ["admin", "manager"] as OrgRole[]) for (const l of [own, theirs, free]) expect(canModifyLead(r, ME, l)).toBe(true)
  })
  it("employé : ses leads et les leads non affectés, JAMAIS ceux d'un collègue", () => {
    expect(canModifyLead("employee", ME, own)).toBe(true)
    expect(canModifyLead("employee", ME, free)).toBe(true)
    expect(canModifyLead("employee", ME, theirs)).toBe(false)
  })
  it("rôle absent ou inconnu : rien", () => {
    expect(canModifyLead(null, ME, free)).toBe(false)
    expect(canModifyLead("root" as OrgRole, ME, free)).toBe(false)
  })
})

describe("qui affecte un lead", () => {
  it("administrateur et manager : à n'importe qui, reprise d'un lead d'un collègue comprise", () => {
    for (const r of ["admin", "manager"] as OrgRole[]) {
      expect(canAssignLead(r, ME, theirs, OTHER)).toBe(true)
      expect(canAssignLead(r, ME, theirs, null)).toBe(true)
    }
  })
  it("employé : prend un lead libre, rend le sien ; ne vole pas le lead d'un collègue, n'affecte personne d'autre", () => {
    expect(canAssignLead("employee", ME, free, ME)).toBe(true)
    expect(canAssignLead("employee", ME, own, null)).toBe(true)
    expect(canAssignLead("employee", ME, theirs, ME)).toBe(false) // vol
    expect(canAssignLead("employee", ME, theirs, null)).toBe(false) // dé-affecter un collègue
    expect(canAssignLead("employee", ME, free, OTHER)).toBe(false) // affecter à un autre
    expect(canAssignLead("employee", ME, own, OTHER)).toBe(false)
  })
})
