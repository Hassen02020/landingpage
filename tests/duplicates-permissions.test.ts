// Permissions des doublons : conseiller signale, Manager décide (jamais son propre signalement), Admin rouvre. Sécurité côté règles.
import { describe, expect, it } from "vitest"
import { ROLE_PERMISSIONS, can, canDecideDuplicate, canFlagDuplicate, canReopenDuplicate, type OrgRole } from "@/lib/permissions"

const ME = "u-me", OTHER = "u-other"
const roles: OrgRole[] = ["employee", "manager", "admin"]
describe("matrice des permissions de doublon", () => {
  it("conseiller : signale seulement ; Manager : signale et décide ; Admin : signale, décide et rouvre", () => {
    expect(roles.map((r) => [can(r, "duplicates.flag"), can(r, "duplicates.review"), can(r, "duplicates.reopen")])).toEqual([[true, false, false], [true, true, false], [true, true, true]])
  })
  it("aucun rôle absent ou inconnu n'a de droit de doublon (dont le Super Admin, sans rôle d'entreprise)", () => {
    for (const r of [null, undefined]) { expect(can(r, "duplicates.flag")).toBe(false); expect(can(r, "duplicates.review")).toBe(false); expect(can(r, "duplicates.reopen")).toBe(false) }
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["admin", "employee", "manager"])
  })
  it("signaler suit le droit de modifier le dossier : un employé ne signale pas sur le dossier d'un collègue", () => {
    expect(canFlagDuplicate("employee", ME, { assigned_to: ME })).toBe(true)
    expect(canFlagDuplicate("employee", ME, { assigned_to: null })).toBe(true)
    expect(canFlagDuplicate("employee", ME, { assigned_to: OTHER })).toBe(false)
    expect(canFlagDuplicate("manager", ME, { assigned_to: OTHER })).toBe(true)
    expect(canFlagDuplicate("admin", ME, { assigned_to: OTHER })).toBe(true)
    expect(canFlagDuplicate(null, ME, { assigned_to: null })).toBe(false)
  })
  it("D1 — double regard SANS EXCEPTION : même un Admin ne décide pas son propre signalement ; un conseiller ne décide jamais", () => {
    expect(canDecideDuplicate("manager", ME, { reported_by: OTHER })).toBe(true)
    expect(canDecideDuplicate("manager", ME, { reported_by: ME })).toBe(false)
    expect(canDecideDuplicate("admin", ME, { reported_by: ME })).toBe(false)
    expect(canDecideDuplicate("admin", ME, { reported_by: OTHER })).toBe(true)
    expect(canDecideDuplicate("employee", ME, { reported_by: OTHER })).toBe(false)
  })
  it("D2 — seul l'administrateur rouvre une décision", () => {
    expect([canReopenDuplicate("employee"), canReopenDuplicate("manager"), canReopenDuplicate("admin"), canReopenDuplicate(null)]).toEqual([false, false, true, false])
  })
})
