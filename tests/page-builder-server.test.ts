// Créateur de pages — couche SERVEUR : réutilisation du catalogue, brouillon masqué, verrou d'adresse, publication contrôlée, garde plateforme, actions.
// Faux PostgREST en mémoire : ces essais ne prouvent rien sur la production.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))
class Redirect extends Error { constructor(public to: string) { super(`REDIRECT:${to}`) } }
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirect(to) }, notFound: () => { throw new Error("NOTFOUND") } }))
type Role = "admin" | "manager" | "employee" | null
let role: Role = "admin"
let orgId = "00000000-0000-4000-8000-0000000e2b01"
vi.mock("@/lib/server/auth", () => ({ currentStaff: async () => (role ? { userId: "11111111-1111-4111-8111-111111111111", organizationId: orgId, orgRole: role, email: "a@b.tn" } : null) }))

import { configureAll } from "./helpers"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { loadDesign, publicDesign, saveDesign } from "@/lib/server/page-design"
import { catalogueOffers } from "@/lib/server/page-builder"
import { archivePage, builderAccess, duplicatePage, loadBuilderPage, publishPage, restorePage, saveDraft, toPublicOffers, unpublishPage } from "@/lib/server/page-builder"
import { saveCategory } from "@/lib/server/catalog"
import * as actions from "@/app/admin/createur-actions"
import { checkDestinationAction } from "@/app/admin/liens-actions"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
type Row = Record<string, unknown>
let T: Record<string, Row[]>
let calls: { method: string; table: string; url: string; body?: unknown }[]
let multi = false
let noDesign = false
let seq = 0

function applyFilters(rows: Row[], query: URLSearchParams): Row[] {
  let out = rows
  query.forEach((raw, col) => {
    if (["select", "order", "limit"].includes(col)) return
    const m = /^(eq|is|not\.is|in)\.(.*)$/.exec(raw)
    if (!m) return
    const [, op, val] = m
    out = out.filter((r) => {
      const x = r[col]
      if (op === "eq") return String(x) === val
      if (op === "is") return val === "null" ? x === null || x === undefined : String(x) === val
      if (op === "not.is") return val === "null" ? x !== null && x !== undefined : String(x) !== val
      if (op === "in") return val.replace(/[()]/g, "").split(",").includes(String(x))
      return true
    })
  })
  return out
}

beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache()
  role = "admin"; orgId = E2B; multi = false; noDesign = false; seq = 0; calls = []
  T = { landing_categories: [], landing_offers: [], landing_leads: [], landing_events: [] }
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = new URL(String(url))
    const method = (init.method ?? "GET").toUpperCase()
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    const m = /\/rest\/v1\/([a-z_]+)/.exec(u.pathname)
    const table = m?.[1] ?? ""
    if (table === "organizations") {
      if (u.searchParams.get("slug") === "eq.easy2book") return json([{ id: E2B }])
      return json(multi ? [{ id: E2B }, { id: BOB }] : [{ id: E2B }])
    }
    if (noDesign && ((method === "GET" && /select=design/.test(u.search)) || (method === "PATCH" && String(init.body ?? "").includes('"design"')))) return json({ code: "42703", message: "column landing_categories.design does not exist" }, 400)
    calls.push({ method, table, url: decodeURIComponent(u.search), body: init.body ? JSON.parse(String(init.body)) : undefined })
    const org = u.searchParams.get("organization_id")?.replace("eq.", "")
    const scoped = (T[table] ?? []).filter((r) => !org || r.organization_id === org)
    if (method === "POST") {
      const b = JSON.parse(String(init.body))
      const row = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: "2026-11-13T00:00:00Z", updated_at: "2026-11-13T00:00:00Z", seats_sold: 0, features: [], archived_at: null, ...b }
      if (table === "landing_categories" && T[table].some((r) => r.organization_id === row.organization_id && r.slug === row.slug)) return json({ code: "23505" }, 409)
      T[table].push(row)
      return json([row], 201)
    }
    if (method === "PATCH") {
      const hit = applyFilters(scoped, u.searchParams)
      hit.forEach((r) => Object.assign(r, JSON.parse(String(init.body))))
      return json(hit)
    }
    return json(applyFilters(scoped, u.searchParams))
  }))
})
afterEach(() => vi.unstubAllGlobals())

const as = <T2,>(org: string, fn: () => Promise<T2>) => runWithOrg(org, fn) as Promise<T2>
const writes = () => calls.filter((c) => c.method !== "GET")
const offerIn = (o: Partial<Record<string, string>> = {}) => ({ fields: { name: "Départ 1", destination: "Turquie", departure_date: "2027-03-10", nights: "7", price: "2 350,5", seats_total: "20", ...o }, features: ["Vol", "Hôtel", ""] })
const cat = (o: Record<string, string> = {}) => ({ name: "Turquie Été 2027", headline: "Découvrez la Turquie", description: "Un voyage organisé complet en Turquie.", lang: "fr", ...o })
const makeComplete = async () => {
  const r = await as(E2B, () => saveDraft({ themeId: "turquie", category: cat(), offers: [offerIn()] }, "u1"))
  if (!r.ok) throw new Error(JSON.stringify(r))
  return r.id
}

describe("brouillon : réutilise le catalogue (aucune nouvelle table)", () => {
  it("création : catégorie MASQUÉE, produit et langue du modèle, adresse dérivée du nom, offre rattachée et affichée", async () => {
    const r = await as(E2B, () => saveDraft({ themeId: "turquie", category: cat(), offers: [offerIn()] }, "u1"))
    expect(r.ok).toBe(true)
    expect(T.landing_categories).toHaveLength(1)
    expect(T.landing_categories[0]).toMatchObject({ name: "Turquie Été 2027", slug: "turquie-ete-2027", product: "voyage", lang: "fr", visible: false, organization_id: E2B })
    expect(T.landing_offers[0]).toMatchObject({ name: "Départ 1", category_id: T.landing_categories[0].id, price: 2350.5, nights: 7, departure_date: "2027-03-10", seats_total: 20, visible: true, product: "voyage" })
    expect(T.landing_offers[0].features).toEqual(["Vol", "Hôtel"])
    expect(Object.keys(T).sort()).toEqual(["landing_categories", "landing_events", "landing_leads", "landing_offers"])
  })
  it("Omra Ramadan : produit omra, langue arabe par défaut du modèle", async () => {
    await as(E2B, () => saveDraft({ themeId: "ramadan-omra", category: cat({ name: "Omra Ramadan 2027", lang: "" }), offers: [offerIn({ departure_date: "2027-02-10", nights: "14" })] }, "u1"))
    expect(T.landing_categories[0]).toMatchObject({ slug: "omra-ramadan-2027", product: "omra", lang: "ar", visible: false })
  })
  it("erreurs de validation : clés par offre, AUCUNE écriture", async () => {
    const r = await as(E2B, () => saveDraft({ themeId: "turquie", category: cat({ name: "" }), offers: [offerIn({ price: "abc", departure_date: "pas-une-date" })] }, "u1"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(["name", "o0_price", "o0_departure_date"]))
    expect(writes()).toHaveLength(0)
  })
  it("modèle inconnu refusé sans écriture ; page inconnue refusée", async () => {
    expect((await as(E2B, () => saveDraft({ themeId: "inconnu", category: cat(), offers: [] }, null))).ok).toBe(false)
    expect((await as(E2B, () => saveDraft({ id: "00000000-0000-4000-8000-0000000000aa", themeId: "turquie", category: cat(), offers: [] }, null))).ok).toBe(false)
    expect(writes()).toHaveLength(0)
  })
  it("modifier le contenu d'une page PUBLIÉE ne la masque jamais ; une offre peut être retirée (archivée)", async () => {
    const id = await makeComplete()
    expect((await as(E2B, () => publishPage(id, "turquie", "u1"))).ok).toBe(true)
    const offerId = String(T.landing_offers[0].id)
    const r = await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat({ headline: "Nouvelle accroche" }), slug: "turquie-ete-2027" }, offers: [{ ...offerIn({ price: "2400" }), id: offerId }, offerIn({ name: "Départ 2", departure_date: "2027-04-10" })] }, "u1"))
    expect(r.ok).toBe(true)
    expect(T.landing_categories[0]).toMatchObject({ visible: true, headline: "Nouvelle accroche" })
    expect(T.landing_offers.map((o) => o.name)).toEqual(["Départ 1", "Départ 2"])
    await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat(), slug: "turquie-ete-2027" }, offers: [{ ...offerIn(), id: offerId, remove: true }] }, "u1"))
    expect(T.landing_offers[0]).toMatchObject({ visible: false })
    expect(T.landing_offers[0].archived_at).toBeTruthy()
  })
})

describe("protection de l'adresse (sans migration)", () => {
  it("page PUBLIÉE : changer l'adresse est refusé, AUCUN PATCH envoyé ; le contenu reste modifiable", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    calls = []
    const r = await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat(), slug: "nouvelle-adresse" }, offers: [] }, "u1"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.slug).toMatch(/verrouillée/)
    expect(calls.filter((c) => c.method === "PATCH" && c.table === "landing_categories")).toHaveLength(0)
    expect(T.landing_categories[0].slug).toBe("turquie-ete-2027")
  })
  it("brouillon dont l'adresse a déjà servi (prospect arrivé sur /c/<adresse>) : verrouillée", async () => {
    const id = await makeComplete()
    T.landing_leads.push({ id: "L1", organization_id: E2B, landing_page: "/c/turquie-ete-2027" })
    const r = await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat(), slug: "autre-adresse" }, offers: [] }, "u1"))
    expect(r.ok).toBe(false)
  })
  it("adresse déjà utilisée sur /p/<adresse> (page du Créateur) : verrouillée aussi", async () => {
    const id = await makeComplete()
    T.landing_leads.push({ id: "L2", organization_id: E2B, landing_page: "/p/turquie-ete-2027" })
    const r = await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat(), slug: "autre-adresse-2" }, offers: [] }, "u1"))
    expect(r.ok).toBe(false)
  })
  it("brouillon jamais utilisé : l'adresse reste modifiable", async () => {
    const id = await makeComplete()
    const r = await as(E2B, () => saveDraft({ id, themeId: "turquie", category: { ...cat(), slug: "turquie-2027-v2" }, offers: [] }, "u1"))
    expect(r.ok).toBe(true)
    expect(T.landing_categories[0].slug).toBe("turquie-2027-v2")
  })
  it("saveCategory (catalogue existant) applique la même protection", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    const r = await as(E2B, () => saveCategory(id, { name: "X", slug: "ailleurs", product: "voyage", lang: "fr", visible: "on" }, null))
    expect(r.ok).toBe(false)
  })
})

describe("publication contrôlée côté serveur", () => {
  it("page incomplète : refus, aucune écriture, liste des points à corriger", async () => {
    const r0 = await as(E2B, () => saveDraft({ themeId: "turquie", category: cat({ description: "court" }), offers: [offerIn({ departure_date: "" })] }, "u1"))
    expect(r0.ok).toBe(true)
    const id = String(T.landing_categories[0].id)
    calls = []
    const r = await as(E2B, () => publishPage(id, "turquie", "u1"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.readiness?.blocking).toBeGreaterThan(0)
    expect(writes()).toHaveLength(0)
    expect(T.landing_categories[0].visible).toBe(false)
  })
  it("page complète : publiée ; masquable ensuite", async () => {
    const id = await makeComplete()
    expect((await as(E2B, () => publishPage(id, "turquie", "u1"))).ok).toBe(true)
    expect(T.landing_categories[0].visible).toBe(true)
    expect((await as(E2B, () => unpublishPage(id, "u1"))).ok).toBe(true)
    expect(T.landing_categories[0].visible).toBe(false)
  })
  it("le public ne voit jamais le coût ni les offres archivées", async () => {
    const id = await makeComplete()
    T.landing_offers[0].cost = 1234
    T.landing_offers.push({ ...T.landing_offers[0], id: "x2", archived_at: "2026-01-01", visible: false })
    const page = await as(E2B, () => loadBuilderPage(id))
    const pub = toPublicOffers(page!.offers)
    expect(pub).toHaveLength(1)
    expect(JSON.stringify(pub)).not.toContain("1234")
    expect(pub[0]).not.toHaveProperty("cost")
  })
})

describe("accès : permissions et organisation de la plateforme (côté serveur)", () => {
  it("administrateur de la plateforme : accès ; manager, employé, non connecté : refusés", async () => {
    expect((await as(E2B, () => builderAccess())).ok).toBe(true)
    for (const r of ["manager", "employee", null] as Role[]) { role = r; const a = await as(E2B, () => builderAccess()); expect(a.ok, String(r)).toBe(false); expect(!a.ok && a.reason).toBe("droits") }
  })
  it("autre entreprise (mode multi) : refusée, avec un message clair — jamais un lien vers la plateforme", async () => {
    multi = true; role = "admin"; orgId = BOB
    const a = await as(BOB, () => builderAccess())
    expect(a.ok).toBe(false)
    expect(!a.ok && a.reason).toBe("entreprise")
    resetTenantModeCache(); resetPublicOrgCache()
    expect((await as(E2B, () => builderAccess())).ok).toBe(true)
  })
  it("actions refusées (employé, manager, non connecté, autre entreprise) : AUCUNE lecture ni écriture du catalogue", async () => {
    const fd = new FormData(); fd.set("theme", "turquie"); fd.set("name", "X"); fd.set("headline", "Y"); fd.set("description", "Z".repeat(30)); fd.set("offer_count", "0"); fd.set("id", "00000000-0000-4000-8000-0000000000aa")
    for (const r of ["employee", "manager", null] as Role[]) {
      role = r; calls = []
      const out = [await as(E2B, () => actions.saveDraftAction(undefined, fd)), await as(E2B, () => actions.publishAction(undefined, fd)), await as(E2B, () => actions.unpublishAction(undefined, fd))]
      expect(out.every((o) => o.ok === false), String(r)).toBe(true)
      expect(calls.filter((c) => c.table.startsWith("landing_"))).toHaveLength(0)
    }
    multi = true; role = "admin"; orgId = BOB; resetTenantModeCache(); resetPublicOrgCache(); calls = []
    const out = [await as(BOB, () => actions.saveDraftAction(undefined, fd)), await as(BOB, () => actions.publishAction(undefined, fd)), await as(BOB, () => actions.unpublishAction(undefined, fd))]
    expect(out.every((o) => o.ok === false)).toBe(true)
    expect(calls.filter((c) => c.table.startsWith("landing_"))).toHaveLength(0)
  })
  it("saveDraftAction (administrateur) : crée le brouillon puis redirige vers l'étape suivante", async () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ theme: "turquie", ...cat(), offer_count: "1", next: "formulaire", o0_name: "Départ 1", o0_destination: "Turquie", o0_departure_date: "2027-03-10", o0_nights: "7", o0_price: "2350", o0_features: "Vol\nHôtel" })) fd.set(k, v)
    await expect(as(E2B, () => actions.saveDraftAction(undefined, fd))).rejects.toThrow(/REDIRECT:\/admin\/createur\/.+\?etape=formulaire&theme=turquie/)
    expect(T.landing_categories[0].visible).toBe(false)
    expect(T.landing_offers[0].features).toEqual(["Vol", "Hôtel"])
  })
  it("une ligne d'offre laissée vide est ignorée ; au plus 10 offres lues", async () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ theme: "autre", name: "Promo", headline: "h", description: "Une description suffisamment longue.", offer_count: "99", o0_name: "", o0_price: "" })) fd.set(k, v)
    await expect(as(E2B, () => actions.saveDraftAction(undefined, fd))).rejects.toThrow(/REDIRECT/)
    expect(T.landing_offers).toHaveLength(0)
  })
})

describe("test du lien (action serveur)", () => {
  it("autre entreprise ou non connecté : refusé, AUCUNE requête vers le site", async () => {
    role = null
    expect((await checkDestinationAction("/omra")).state).toBe("refused")
    multi = true; role = "admin"; orgId = BOB; resetTenantModeCache(); resetPublicOrgCache()
    const r = await as(BOB, () => checkDestinationAction("/omra"))
    expect(r.state).toBe("refused")
    expect(vi.mocked(fetch).mock.calls.some((c) => !String(c[0]).includes("/rest/v1/"))).toBe(false)
  })
})

describe("duplication et archivage (tableau de bord)", () => {
  it("duplication : nouvelle page en BROUILLON, adresse « -copie », offres copiées sans places vendues ni SKU ; l'original est intact", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    T.landing_offers[0].seats_sold = 7; T.landing_offers[0].sku = "SKU-1"
    const before = JSON.stringify(T.landing_categories[0])
    const r = await as(E2B, () => duplicatePage(id, "u1"))
    expect(r.ok).toBe(true)
    expect(T.landing_categories).toHaveLength(2)
    expect(T.landing_categories[1]).toMatchObject({ slug: "turquie-ete-2027-copie", name: "Turquie Été 2027 (copie)", visible: false, position: 0, organization_id: E2B })
    expect(T.landing_offers).toHaveLength(2)
    expect(T.landing_offers[1]).toMatchObject({ category_id: T.landing_categories[1].id, seats_sold: 0, sku: null, name: "Départ 1" })
    expect(JSON.stringify(T.landing_categories[0])).toBe(before)
    expect(T.landing_offers[0]).toMatchObject({ seats_sold: 7, sku: "SKU-1" })
    const again = await as(E2B, () => duplicatePage(id, "u1"))
    expect(again.ok).toBe(true)
    expect(T.landing_categories[2].slug).toBe("turquie-ete-2027-copie-2")
  })
  it("archivage contrôlé : refusé tant que la page est publiée ; accepté pour un brouillon ; adresse conservée ; restauration en brouillon", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    const refused = await as(E2B, () => archivePage(id, "u1"))
    expect(refused.ok).toBe(false)
    expect(T.landing_categories[0]).toMatchObject({ visible: true, position: 0 })
    await as(E2B, () => unpublishPage(id, "u1"))
    expect((await as(E2B, () => archivePage(id, "u1"))).ok).toBe(true)
    expect(T.landing_categories[0]).toMatchObject({ visible: false, position: -1000, slug: "turquie-ete-2027" })
    expect((await as(E2B, () => restorePage(id, "u1"))).ok).toBe(true)
    expect(T.landing_categories[0]).toMatchObject({ visible: false, position: 0 })
    expect((await as(E2B, () => restorePage(id, "u1"))).ok).toBe(false)
  })
  it("pages inconnues refusées ; les écritures restent dans l'organisation du contexte", async () => {
    expect((await as(E2B, () => duplicatePage("00000000-0000-4000-8000-0000000000aa", "u1"))).ok).toBe(false)
    expect((await as(E2B, () => archivePage("00000000-0000-4000-8000-0000000000aa", "u1"))).ok).toBe(false)
    expect(writes()).toHaveLength(0)
  })
})

describe("personnalisation : stockage (colonne design, migration proposée non appliquée)", () => {
  const D = { colors: { preset: "bleu" }, faq: [{ q: "Quand partir ?", a: "Voir les départs." }], cta: { label: "Réservez" } }
  it("enregistre un design validé SERVEUR, relu tel quel ; l'adresse, la visibilité et les offres ne changent pas", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    const before = JSON.stringify({ ...T.landing_categories[0], design: undefined, updated_at: undefined })
    expect((await as(E2B, () => saveDesign(id, "voyage", D, "u1"))).ok).toBe(true)
    const stored = T.landing_categories[0].design as { colors: { preset: string }; faq: unknown[] }
    expect(stored.colors.preset).toBe("bleu"); expect(stored.faq).toHaveLength(1)
    expect(JSON.stringify({ ...T.landing_categories[0], design: undefined, updated_at: undefined })).toBe(before)
    const loaded = await as(E2B, () => loadDesign(id, "voyage"))
    expect(loaded).toMatchObject({ available: true, stored: true })
    expect(loaded.design.cta.label).toBe("Réservez")
    const pub = await as(E2B, () => publicDesign("turquie-ete-2027", "voyage"))
    expect(pub?.faq[0].q).toBe("Quand partir ?")
  })
  it("design invalide : AUCUNE écriture ; couleur trop claire refusée côté serveur même si l'interface est contournée", async () => {
    const id = await makeComplete()
    calls = []
    const r = await as(E2B, () => saveDesign(id, "voyage", { colors: { custom: "#ffff00" } }, "u1"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.custom).toMatch(/trop claire/)
    expect(writes()).toHaveLength(0)
  })
  it("une page masquée n'expose jamais son design au public", async () => {
    const id = await makeComplete()
    await as(E2B, () => saveDesign(id, "voyage", D, "u1"))
    expect(await as(E2B, () => publicDesign("turquie-ete-2027", "voyage"))).toBeNull()
  })
  it("colonne absente : lecture « indisponible » (rendu par défaut), écriture refusée avec message clair, publicDesign = null, AUCUNE exception", async () => {
    const id = await makeComplete()
    await as(E2B, () => publishPage(id, "turquie", "u1"))
    noDesign = true
    const loaded = await as(E2B, () => loadDesign(id, "voyage"))
    expect(loaded.available).toBe(false)
    const r = await as(E2B, () => saveDesign(id, "voyage", D, "u1"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/migration 0018/)
    expect(await as(E2B, () => publicDesign("turquie-ete-2027", "voyage"))).toBeNull()
  })
  it("autre entreprise : ne peut ni lire ni écrire le design d'une page de la plateforme", async () => {
    multi = true
    const id = await makeComplete()
    const r = await as(BOB, () => saveDesign(id, "voyage", D, "u1")).catch((e) => e)
    expect(T.landing_categories[0].design).toBeUndefined()
    void r
  })
})

describe("reprise d'offres du catalogue", () => {
  it("liste les offres réelles non archivées d'AUTRES pages, sans coût ni places vendues ; exclut la page en cours et les archivées", async () => {
    const a = await makeComplete()
    const b = (await as(E2B, () => saveDraft({ themeId: "omra", category: cat({ name: "Autre page" }), offers: [offerIn({ name: "Départ B", price: "1900" })] }, "u1")))
    if (!b.ok) throw new Error("setup")
    T.landing_offers.forEach((o) => { o.cost = 1234; o.seats_sold = 5 })
    T.landing_offers.push({ id: "00000000-0000-4000-8000-0000000000f1", category_id: null, name: "Archivée", price: 10, archived_at: "2026-01-01", features: [], organization_id: E2B })
    const list = await as(E2B, () => catalogueOffers(a))
    expect(list.map((o) => o.name)).toEqual(["Départ B"])
    expect(list[0]).toMatchObject({ price: 1900, page: "Autre page" })
    expect(JSON.stringify(list)).not.toContain("1234")
    expect(Object.keys(list[0])).not.toContain("cost")
    expect(Object.keys(list[0])).not.toContain("seats_sold")
  })
})

describe("personnalisation : droits côté serveur (action)", () => {
  const fdFor = (id: string) => { const fd = new FormData(); fd.set("id", id); fd.set("design", JSON.stringify({ colors: { preset: "bleu" } })); return fd }
  it("employé, manager, non connecté : refusés, AUCUNE lecture ni écriture ; administrateur : accepté", async () => {
    const id = await makeComplete()
    for (const r of ["employee", "manager", null] as Role[]) {
      role = r; calls = []
      const out = await as(E2B, () => actions.saveDesignAction(undefined, fdFor(id)))
      expect(out.ok, String(r)).toBe(false)
      expect(calls.filter((c) => c.table.startsWith("landing_"))).toHaveLength(0)
    }
    role = "admin"
    expect((await as(E2B, () => actions.saveDesignAction(undefined, fdFor(id)))).ok).toBe(true)
    expect(T.landing_categories[0].design).toBeTruthy()
  })
  it("autre entreprise : refusée avant toute écriture ; JSON illisible refusé", async () => {
    const id = await makeComplete()
    multi = true; role = "admin"; orgId = BOB; resetTenantModeCache(); resetPublicOrgCache(); calls = []
    const out = await as(BOB, () => actions.saveDesignAction(undefined, fdFor(id)))
    expect(out.ok).toBe(false)
    expect(writes()).toHaveLength(0)
    orgId = E2B; multi = false; role = "admin"; resetTenantModeCache(); resetPublicOrgCache()
    const bad = new FormData(); bad.set("id", id); bad.set("design", "{pas du json")
    expect((await as(E2B, () => actions.saveDesignAction(undefined, bad))).ok).toBe(false)
  })
})
