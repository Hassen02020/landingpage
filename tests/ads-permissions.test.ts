// Permissions de la RENTABILITÉ (dépenses, coûts variables, import et confirmation des commissions, analyse).
// Quatre identités : Administrateur, Manager, Employé, utilisateur non connecté — plus le Super Admin de la plateforme.
// Garanties vérifiées : pages, menu et les SEPT actions serveur ; un refus ne déclenche AUCUN appel réseau ni écriture ;
// le Super Admin n'a aucun accès implicite aux données financières des entreprises ; une mauvaise permission fait échouer la suite.
// Tout est simulé en mémoire : aucune base, aucun réseau réel.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { configureAll } from "./helpers"


const ORG = "00000000-0000-4000-8000-0000000e2b01"
const SUPER_ID = "aaaaaaaa-0000-4000-8000-0000000000ff"

// ---- session simulée (remplace currentStaff) ; le mode « réel » sert au test du Super Admin
type Role = "admin" | "manager" | "employee" | null
let role: Role = null
let useRealAuth = false
let uid = 0
const COOKIE = "e2b_admin_at"

vi.mock("next/headers", () => ({ cookies: () => ({ get: (n: string) => (useRealAuth && n === COOKIE ? { value: "token-super-admin" } : undefined) }) }))
vi.mock("@/app/admin/actions", () => ({ logoutAction: "/admin/logout" }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }), redirect: () => undefined }))
vi.mock("@/lib/server/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/server/auth")>()
  return { ...real, currentStaff: async () => (useRealAuth ? real.currentStaff() : role ? { userId: `u-${++uid}`, organizationId: ORG, orgRole: role, email: "x@y.tn", fullName: null, role: "admin", organizationName: "E2B", organizationSlug: "e2b" } : null) }
})

import * as actions from "@/app/admin/rentabilite-actions"
import { can, PLATFORM_PERMISSIONS, ROLE_PERMISSIONS, canPlatform, type OrgRole } from "@/lib/permissions"

// Les composants .tsx sont compilés avec l'ancien runtime JSX (React global) : on le fournit puis on les charge, sans toucher à la configuration du projet.
let RentabilitePage: typeof import("@/app/admin/(crm)/rentabilite/page").default
let AnalysePage: typeof import("@/app/admin/(crm)/rentabilite/analyse/page").default
let AdminShell: typeof import("@/app/admin/(crm)/_components/AdminShell").AdminShell
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  RentabilitePage = (await import("@/app/admin/(crm)/rentabilite/page")).default
  AnalysePage = (await import("@/app/admin/(crm)/rentabilite/analyse/page")).default
  AdminShell = (await import("@/app/admin/(crm)/_components/AdminShell")).AdminShell
})

// ---- réseau simulé : compte tout appel ; « écriture » = méthode autre que GET
let calls: { url: string; method: string }[]
const writes = () => calls.filter((c) => c.method !== "GET")
const FINANCE = /landing_(ad_spend|commissions|variable_costs)/

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  role = null; useRealAuth = false; calls = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = decodeURIComponent(String(url))
    calls.push({ url: u, method: (init.method ?? "GET").toUpperCase() })
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
    if (u.includes("/auth/v1/user")) return json({ id: SUPER_ID, email: "super@plateforme.tn" })
    if (u.includes("platform_admins")) return json([{ user_id: SUPER_ID }])
    return json([]) // organization_members, landing_staff, tables financières… : vides
  }))
})
afterEach(() => vi.unstubAllGlobals())

const form = () => {
  const f = new FormData()
  f.set("date", "2026-11-05"); f.set("network", "meta"); f.set("campaign", "omra-2027"); f.set("amount", "10"); f.set("category", "autre")
  return f
}
/** Appelle les SEPT actions ; renvoie la réponse de chacune. */
async function callAll(a: typeof actions) {
  return {
    addSpend: await a.addSpendAction(undefined, form()),
    addCost: await a.addCostAction(undefined, form()),
    voidSpend: await a.voidSpendAction(1),
    voidCost: await a.voidCostAction(1),
    preview: await a.previewImportAction("reservation_ref;nature;montant_tnd;date\nR1;commission;10;2026-11-05"),
    commit: await a.commitImportAction("reservation_ref;nature;montant_tnd;date\nR1;commission;10;2026-11-05", []),
    confirm: await a.confirmCommissionsAction([1]),
  }
}
const refused = (r: Awaited<ReturnType<typeof callAll>>) =>
  r.addSpend.ok === false && r.addCost.ok === false && r.voidSpend.ok === false && r.voidCost.ok === false && "fatal" in r.preview && "fatal" in r.commit && r.confirm.confirmed === 0 && Boolean(r.confirm.message)
const html = async (page: () => Promise<unknown>) => renderToStaticMarkup((await page()) as never)
const DENIED_TEXT = "réservée aux responsables"

describe("liste fermée : exactement sept actions serveur", () => {
  it("toute nouvelle action doit être ajoutée ici ET protégée (sinon la CI échoue)", () => {
    expect(Object.keys(actions).sort()).toEqual(["addCostAction", "addSpendAction", "commitImportAction", "confirmCommissionsAction", "previewImportAction", "voidCostAction", "voidSpendAction"])
  })
})

describe("table des droits", () => {
  it("ads.view : admin et manager ; ads.manage : admin seulement ; employé et inconnu : rien", () => {
    const cell = (r: unknown, p: "ads.view" | "ads.manage") => can(r as OrgRole, p)
    expect([cell("admin", "ads.view"), cell("admin", "ads.manage")]).toEqual([true, true])
    expect([cell("manager", "ads.view"), cell("manager", "ads.manage")]).toEqual([true, false])
    expect([cell("employee", "ads.view"), cell("employee", "ads.manage")]).toEqual([false, false])
    for (const r of [null, undefined, "", "root", "super_admin"]) expect([cell(r, "ads.view"), cell(r, "ads.manage")], String(r)).toEqual([false, false])
  })
})

describe("les sept actions : refus sans aucune écriture ni appel réseau", () => {
  for (const r of ["employee", "manager", null] as Role[]) {
    it(`${r ?? "non connecté"} : toutes refusées, 0 appel réseau, 0 écriture`, async () => {
      role = r
      const out = await callAll(actions)
      expect(refused(out), JSON.stringify(out)).toBe(true)
      expect(calls, JSON.stringify(calls)).toHaveLength(0)
      expect(writes()).toHaveLength(0)
    })
  }

  it("TÉMOIN administrateur : une écriture atteint bien la couche réseau simulée (le compteur fonctionne)", async () => {
    role = "admin"
    await actions.addSpendAction(undefined, form())
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.some((c) => FINANCE.test(c.url))).toBe(true)
    expect(writes().some((c) => /landing_ad_spend/.test(c.url))).toBe(true)
  })

  it("témoin administrateur : l'aperçu d'import lit mais n'écrit pas", async () => {
    role = "admin"
    await actions.previewImportAction("reservation_ref;nature;montant_tnd;date\nR1;commission;10;2026-11-05")
    expect(writes()).toHaveLength(0)
  })
})

describe("pages", () => {
  for (const r of ["employee", null] as Role[]) {
    it(`${r ?? "non connecté"} : les deux pages affichent le refus, sans lire aucune donnée`, async () => {
      role = r
      for (const page of [() => RentabilitePage(), () => AnalysePage({ searchParams: {} })]) expect(await html(page)).toContain(DENIED_TEXT)
      expect(calls).toHaveLength(0)
    })
  }
  for (const r of ["admin", "manager"] as Role[]) {
    it(`${r} : les deux pages chargent leurs données (pas de message de refus)`, async () => {
      role = r
      const analyse = await AnalysePage({ searchParams: {} })
      expect(renderToStaticMarkup(analyse as never)).not.toContain(DENIED_TEXT)
      const saisie = (await RentabilitePage()) as { props?: { children?: unknown[] } }
      expect((saisie.props?.children ?? []).some((c) => (c as { type?: string } | null)?.type === "p"), "pas de paragraphe de refus").toBe(false)
      expect(calls.length).toBeGreaterThan(0)
      expect(writes()).toHaveLength(0) // consulter n'écrit jamais
    })
  }
  it("manager : la page de saisie est en lecture seule (canManage = false)", async () => {
    role = "manager"
    const el = (await RentabilitePage()) as { props: { children: { props?: { canManage?: boolean } }[] } }
    const client = (el.props.children as { props?: { canManage?: boolean } }[]).find((c) => c && c.props && "canManage" in c.props)
    expect(client?.props?.canManage).toBe(false)
  })
  it("administrateur : la page de saisie est en écriture (canManage = true)", async () => {
    role = "admin"
    // les tables simulées sont vides mais « présentes » : la migration est réputée appliquée
    const el = (await RentabilitePage()) as { props: { children: { props?: { canManage?: boolean } }[] } }
    const client = (el.props.children as { props?: { canManage?: boolean } }[]).find((c) => c && c.props && "canManage" in c.props)
    expect(client?.props?.canManage).toBe(true)
  })
})

describe("menu", () => {
  const menu = (r: OrgRole) => renderToStaticMarkup(createElement(AdminShell, { email: "a@b.tn", name: "A", role: r, orgName: "E2B", orgSlug: "e2b", children: null }))
  it("« Rentabilité » visible pour l'administrateur et le manager, absente pour l'employé", () => {
    expect(menu("admin")).toContain("/admin/rentabilite")
    expect(menu("manager")).toContain("/admin/rentabilite")
    expect(menu("employee")).not.toContain("/admin/rentabilite")
  })
})

describe("Super Admin : aucun accès implicite aux données financières des entreprises", () => {
  it("aucune permission de plateforme ne touche à la rentabilité, aux commissions ou aux leads", () => {
    for (const p of Array.from(PLATFORM_PERMISSIONS)) expect(p, p).not.toMatch(/(^|\.)(ads|commissions?|spend|costs?|leads?|finance|margin)(\.|$)/i)
    for (const p of ["ads.view", "ads.manage", "leads.view_all"]) expect(canPlatform(true, p as never), p).toBe(false)
  })
  it("le rôle « super_admin » n'existe pas parmi les rôles d'entreprise et n'ouvre aucun droit de rentabilité", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["admin", "employee", "manager"])
    expect(can("super_admin" as OrgRole, "ads.view")).toBe(false)
    expect(can("super_admin" as OrgRole, "ads.manage")).toBe(false)
  })
  it("un Super Admin connecté (jeton valide, présent dans platform_admins) sans fiche d'équipe : sept actions refusées, aucune table financière touchée", async () => {
    useRealAuth = true
    const out = await callAll(actions)
    expect(refused(out), JSON.stringify(out)).toBe(true)
    expect(calls.some((c) => c.url.includes("/auth/v1/user")), "la vraie résolution de session a bien été exercée").toBe(true)
    expect(calls.filter((c) => FINANCE.test(c.url) || /landing_leads/.test(c.url))).toHaveLength(0)
    expect(writes()).toHaveLength(0)
  })
  it("le même Super Admin sur les deux pages : refus, sans lecture financière", async () => {
    useRealAuth = true
    for (const page of [() => RentabilitePage(), () => AnalysePage({ searchParams: {} })]) expect(await html(page)).toContain(DENIED_TEXT)
    expect(calls.filter((c) => FINANCE.test(c.url) || /landing_leads/.test(c.url))).toHaveLength(0)
  })
})

describe("régression : une mauvaise permission FAIT ÉCHOUER la suite", () => {
  it("si le manager recevait ads.manage, la vérification « refus sans écriture » échouerait", async () => {
    vi.resetModules()
    vi.doMock("@/lib/permissions", async (orig) => {
      const real = await orig<typeof import("@/lib/permissions")>()
      return { ...real, can: (r: unknown, p: string) => (r === "manager" && p === "ads.manage" ? true : real.can(r as OrgRole, p as never)) }
    })
    const sabotaged = await import("@/app/admin/rentabilite-actions")
    role = "manager"
    calls = []
    await callAll(sabotaged)
    // la même assertion que pour un manager sain (0 écriture) est maintenant FAUSSE : la suite détecte la régression
    expect(writes().length, "une écriture a eu lieu : la garde « 0 écriture » aurait fait échouer le test du manager").toBeGreaterThan(0)
    vi.doUnmock("@/lib/permissions")
    vi.resetModules()
  })
})
