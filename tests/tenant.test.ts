import { afterEach, describe, expect, it, vi } from "vitest"
import { ORG_ROLES, PLATFORM_PERMISSIONS, ROLE_PERMISSIONS, can, canPlatform, roleFromLegacyStaff, type Permission } from "@/lib/permissions"
import { DEFAULT_ORG_ID, TenantError, assertSameOrg, isPlatformAdmin, orgFilter, resolveMembership, scoped } from "@/lib/server/tenant"
import { configureAll } from "./helpers"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const UID = "00000000-0000-4000-8000-000000000003"

describe("matrice des rôles", () => {
  it("admin : tout ; manager : suivi commercial sans réglages ; employé : uniquement ses leads", () => {
    const all = Array.from(ROLE_PERMISSIONS.admin)
    for (const p of all) expect(can("admin", p)).toBe(true)
    for (const p of ["org.profile.edit", "social.connect", "employees.manage", "site.manage", "campaigns.manage"] as Permission[]) {
      expect(can("manager", p), `manager ne doit pas avoir ${p}`).toBe(false)
      expect(can("employee", p), `employé ne doit pas avoir ${p}`).toBe(false)
    }
    expect(can("manager", "leads.assign") && can("manager", "leads.view_all") && can("manager", "reports.view")).toBe(true)
    expect(can("employee", "leads.view_all") || can("employee", "leads.assign") || can("employee", "reports.view") || can("employee", "leads.update")).toBe(false)
    expect(can("employee", "leads.view_assigned") && can("employee", "leads.update_assigned")).toBe(true)
  })

  it("hiérarchie stricte : les droits d'un employé ⊂ ceux d'un manager ⊂ ceux d'un admin", () => {
    for (const p of Array.from(ROLE_PERMISSIONS.employee)) expect(ROLE_PERMISSIONS.manager.has(p)).toBe(true)
    for (const p of Array.from(ROLE_PERMISSIONS.manager)) expect(ROLE_PERMISSIONS.admin.has(p)).toBe(true)
    expect(ORG_ROLES).toEqual(["admin", "manager", "employee"])
  })

  it("aucun rôle ou rôle inconnu : aucun droit", () => {
    expect(can(null, "leads.view_assigned")).toBe(false)
    expect(can(undefined, "leads.view_assigned")).toBe(false)
    expect(can("superuser" as never, "leads.view_assigned")).toBe(false)
  })

  it("Super Admin : gouvernance des organisations seulement, jamais les leads ; sans le rôle : rien", () => {
    expect(canPlatform(true, "organizations.suspend")).toBe(true)
    expect(canPlatform(false, "organizations.suspend")).toBe(false)
    expect(Array.from(PLATFORM_PERMISSIONS).some((p) => p.startsWith("leads"))).toBe(false)
  })

  it("équipe actuelle : admin → admin, agent (et tout autre) → employé", () => {
    expect(roleFromLegacyStaff("admin")).toBe("admin")
    expect(roleFromLegacyStaff("agent")).toBe("employee")
    expect(roleFromLegacyStaff("n'importe quoi")).toBe("employee")
  })
})

describe("filtre d'organisation côté serveur", () => {
  it("construit le filtre ; refuse tout identifiant mal formé (aucune injection dans la requête)", () => {
    expect(orgFilter(DEFAULT_ORG_ID)).toBe(`organization_id=eq.${DEFAULT_ORG_ID}`)
    expect(scoped("select=*&limit=5", DEFAULT_ORG_ID)).toBe(`select=*&limit=5&organization_id=eq.${DEFAULT_ORG_ID}`)
    expect(scoped("", DEFAULT_ORG_ID)).toBe(`organization_id=eq.${DEFAULT_ORG_ID}`)
    for (const bad of ["", "1", "x;drop", `${DEFAULT_ORG_ID}&status=eq.perdu`, `${DEFAULT_ORG_ID}%26x`, "or=(id.neq.0)"]) expect(() => orgFilter(bad)).toThrow(TenantError)
    expect(() => scoped("select=*", "a|b")).toThrow(TenantError)
  })

  it("assertSameOrg : une ressource d'une autre organisation (ou sans organisation) est refusée", () => {
    expect(() => assertSameOrg({ organization_id: DEFAULT_ORG_ID }, DEFAULT_ORG_ID)).not.toThrow()
    expect(() => assertSameOrg({ organization_id: "00000000-0000-4000-8000-000000000002" }, DEFAULT_ORG_ID)).toThrow(/autre organisation/)
    expect(() => assertSameOrg({}, DEFAULT_ORG_ID)).toThrow(TenantError)
    expect(() => assertSameOrg(null, DEFAULT_ORG_ID)).toThrow(TenantError)
  })
})

function mockFetch(handler: (table: string, query: string) => { status: number; body?: unknown }) {
  const calls: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    const u = new URL(String(url))
    const table = u.pathname.replace("/rest/v1/", "")
    calls.push(`${table}?${u.search.slice(1)}`)
    const r = handler(table, u.search.slice(1))
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
  }))
  return calls
}

describe("contexte de l'utilisateur (membre, repli, Super Admin)", () => {
  it("lit organization_members : organisation et rôle réels ; aucun membre actif → null (pas d'accès)", async () => {
    configureAll()
    mockFetch(() => ({ status: 200, body: [{ organization_id: "00000000-0000-4000-8000-000000000001", role: "manager" }] }))
    expect(await resolveMembership(UID, "agent")).toEqual({ organizationId: "00000000-0000-4000-8000-000000000001", role: "manager", source: "members" })
    mockFetch(() => ({ status: 200, body: [] }))
    expect(await resolveMembership(UID, "admin")).toBeNull() // table présente mais compte non membre : le rôle historique ne suffit PAS
  })

  it("migration 0008 non appliquée (table absente) : repli sur l'équipe actuelle = Easy2Book ; sans rôle historique : erreur remontée", async () => {
    configureAll()
    mockFetch(() => ({ status: 404, body: { code: "PGRST205" } }))
    expect(await resolveMembership(UID, "agent")).toEqual({ organizationId: DEFAULT_ORG_ID, role: "employee", source: "legacy_staff" })
    expect(await resolveMembership(UID, "admin")).toEqual({ organizationId: DEFAULT_ORG_ID, role: "admin", source: "legacy_staff" })
    await expect(resolveMembership(UID)).rejects.toThrow()
  })

  it("une panne de base n'accorde JAMAIS le repli (500 ≠ table absente)", async () => {
    configureAll()
    mockFetch(() => ({ status: 500, body: { code: "XX000" } }))
    await expect(resolveMembership(UID, "admin")).rejects.toThrow()
  })

  it("un identifiant d'utilisateur mal formé est refusé sans requête", async () => {
    configureAll()
    const calls = mockFetch(() => ({ status: 200, body: [] }))
    expect(await resolveMembership("x&role=eq.admin", "admin")).toBeNull()
    expect(await isPlatformAdmin("x&1=1")).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it("Super Admin : vrai seulement si la ligne existe ; table absente ou panne de lecture vide → faux", async () => {
    configureAll()
    mockFetch(() => ({ status: 200, body: [{ user_id: UID }] }))
    expect(await isPlatformAdmin(UID)).toBe(true)
    mockFetch(() => ({ status: 200, body: [] }))
    expect(await isPlatformAdmin(UID)).toBe(false)
    mockFetch(() => ({ status: 404, body: { code: "PGRST205" } }))
    expect(await isPlatformAdmin(UID)).toBe(false)
    mockFetch(() => ({ status: 500, body: {} }))
    await expect(isPlatformAdmin(UID)).rejects.toThrow() // pas de « faux » silencieux sur une panne : l'appelant décide
  })
})
