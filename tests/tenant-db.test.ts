import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { insertOne, insertQuiet, resetTenantModeCache, rpc, runWithOrg, select, TenantContextError, update, upsertQuiet, DbError } from "@/lib/server/db"
import { DEFAULT_ORG_ID } from "@/lib/org-id"
import { configureAll, DB_URL } from "./helpers"

const A = "00000000-0000-4000-8000-00000000000a"
const B = "00000000-0000-4000-8000-00000000000b"

interface Call { url: string; method: string; body: any }
/** Base simulée : la table organizations contrôle le mode ; toutes les autres requêtes sont enregistrées. */
function mockDb(orgs: { status: number; rows?: { id: string }[] }) {
  const data: Call[] = []
  const probes: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url)
    if (u.startsWith(`${DB_URL}/rest/v1/organizations?`)) {
      probes.push(u)
      return new Response(orgs.status === 200 ? JSON.stringify(orgs.rows ?? []) : JSON.stringify({ code: "PGRST205" }), { status: orgs.status })
    }
    data.push({ url: decodeURIComponent(u), method: (init.method || "GET").toUpperCase(), body: init.body ? JSON.parse(String(init.body)) : undefined })
    return new Response("[]", { status: 200 })
  }))
  return { data, probes, last: () => data[data.length - 1] }
}

beforeEach(() => {
  configureAll()
  resetTenantModeCache()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("mode « off » : schéma d'avant 0008 (table absente ou vide) → comportement historique, aucune requête modifiée", () => {
  const cases: [string, { status: number; rows?: { id: string }[] }][] = [["table absente (404)", { status: 404 }], ["table vide", { status: 200, rows: [] }]]
  for (const [label, orgs] of cases) {
    it(label, async () => {
      const m = mockDb(orgs)
      await select("landing_leads", "select=*&status=eq.nouveau")
      await insertQuiet("landing_leads", { ref: "E2B-AAAAAA" })
      await update("landing_leads", "id=eq.1", { status: "contacte" })
      expect(m.data.map((c) => c.url)).toEqual([`${DB_URL}/rest/v1/landing_leads?select=*&status=eq.nouveau`, `${DB_URL}/rest/v1/landing_leads`, `${DB_URL}/rest/v1/landing_leads?id=eq.1`])
      expect(m.data[1].body).toEqual({ ref: "E2B-AAAAAA" }) // pas d'organization_id ajouté
    })
  }
})

describe("mode « single » : une seule organisation (Easy2Book aujourd'hui) → tout y est rattaché", () => {
  const single = { status: 200, rows: [{ id: DEFAULT_ORG_ID }] }

  it("lectures et modifications reçoivent le filtre d'organisation, sur les 13 tables", async () => {
    const m = mockDb(single)
    const tables = ["landing_leads", "landing_events", "landing_lead_activities", "landing_staff", "landing_integrations", "landing_integration_changes", "landing_admin_log", "landing_protection", "landing_blocklist", "landing_categories", "landing_offers", "landing_promo_codes", "landing_message_templates"]
    for (const t of tables) {
      await select(t, "select=*&limit=5")
      expect(m.last().url).toBe(`${DB_URL}/rest/v1/${t}?select=*&limit=5&organization_id=eq.${DEFAULT_ORG_ID}`)
      await update(t, "id=eq.7", { note: "x" })
      expect(m.last().url).toBe(`${DB_URL}/rest/v1/${t}?id=eq.7&organization_id=eq.${DEFAULT_ORG_ID}`)
    }
    await select("landing_leads", "") // requête sans paramètres
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_leads?organization_id=eq.${DEFAULT_ORG_ID}`)
  })

  it("insertions (objet, lot, upsert) reçoivent organization_id ; une AUTRE organisation est refusée", async () => {
    const m = mockDb(single)
    await insertQuiet("landing_leads", { ref: "E2B-AAAAAA" })
    expect(m.last().body).toEqual({ ref: "E2B-AAAAAA", organization_id: DEFAULT_ORG_ID })
    await insertOne("landing_offers", { sku: "x" })
    expect(m.last().body.organization_id).toBe(DEFAULT_ORG_ID)
    await upsertQuiet("landing_integrations", { provider: "meta" }, "provider")
    expect(m.last().body.organization_id).toBe(DEFAULT_ORG_ID)
    expect(m.last().url).toContain("on_conflict=organization_id,provider") // la cible de conflit est TOUJOURS (organisation, …)
    await insertQuiet("landing_leads", { ref: "E2B-BBBBBB", organization_id: DEFAULT_ORG_ID }) // valeur identique : acceptée
    const before = m.data.length
    await expect(insertQuiet("landing_leads", { ref: "E2B-CCCCCC", organization_id: B })).rejects.toThrow(TenantContextError)
    expect(m.data.length).toBe(before) // rien n'est parti vers la base
  })

  it("filtre explicite sur une autre organisation, changement d'organisation par PATCH, contexte étranger : refusés sans requête", async () => {
    const m = mockDb(single)
    await select("landing_leads", `select=*&organization_id=eq.${DEFAULT_ORG_ID}`) // identique : accepté, pas de doublon
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_leads?select=*&organization_id=eq.${DEFAULT_ORG_ID}`)
    const before = m.data.length
    await expect(select("landing_leads", `select=*&organization_id=eq.${B}`)).rejects.toThrow(/filtre d'organisation/)
    await expect(update("landing_leads", "id=eq.1", { organization_id: B })).rejects.toThrow(/changement d'organisation/)
    await expect(Promise.resolve(runWithOrg(B, () => select("landing_leads", "select=*")))).rejects.toThrow(/inconnue de cette base/)
    expect(m.data.length).toBe(before)
  })

  it("tables et fonctions hors cloisonnement (organisations, vues, rpc) ne sont pas modifiées", async () => {
    const m = mockDb(single)
    await select("organization_members", "select=*&user_id=eq.x")
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/organization_members?select=*&user_id=eq.x`)
    await select("landing_niche_performance", "select=*")
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_niche_performance?select=*`)
    await rpc("landing_redeem_promo", { p_code: "X", p_product: "omra" })
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/rpc/landing_redeem_promo`)
  })

  it("la sonde est mise en cache 30 s (une seule requête pour plusieurs accès) puis relue", async () => {
    vi.useFakeTimers()
    const m = mockDb(single)
    await select("landing_leads", "a=1")
    await select("landing_leads", "a=2")
    await insertQuiet("landing_events", { x: 1 })
    expect(m.probes.length).toBe(1)
    vi.advanceTimersByTime(31_000)
    await select("landing_leads", "a=3")
    expect(m.probes.length).toBe(2)
  })
})

describe("mode « multi » : plusieurs organisations → contexte obligatoire, refus par défaut", () => {
  const multi = { status: 200, rows: [{ id: A }, { id: B }] }

  it("SANS contexte : toute requête vers une table d'entreprise est refusée AVANT d'atteindre la base", async () => {
    const m = mockDb(multi)
    for (const op of [() => select("landing_leads", "select=*"), () => update("landing_leads", "id=eq.1", { status: "perdu" }), () => insertQuiet("landing_leads", { ref: "E2B-AAAAAA" }), () => select("landing_events", "select=*")])
      await expect(op()).rejects.toThrow(TenantContextError)
    expect(m.data.length).toBe(0)
  })

  it("AVEC contexte : chaque organisation ne lit et n'écrit que dans la sienne", async () => {
    const m = mockDb(multi)
    await runWithOrg(A, () => select("landing_leads", "select=*"))
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_leads?select=*&organization_id=eq.${A}`)
    await runWithOrg(B, () => insertQuiet("landing_leads", { ref: "E2B-BBBBBB" }))
    expect(m.last().body.organization_id).toBe(B)
    await expect(Promise.resolve(runWithOrg(A, () => insertQuiet("landing_leads", { organization_id: B })))).rejects.toThrow(/organisation différente/)
    await expect(Promise.resolve(runWithOrg(A, () => select("landing_leads", `organization_id=eq.${B}`)))).rejects.toThrow(/filtre d'organisation/)
  })

  it("requêtes simultanées de deux organisations : aucun mélange de contexte", async () => {
    const m = mockDb(multi)
    await Promise.all([
      runWithOrg(A, async () => { await select("landing_leads", "tag=1"); await new Promise((r) => setTimeout(r, 5)); await select("landing_leads", "tag=2") }),
      runWithOrg(B, async () => { await select("landing_leads", "tag=3"); await new Promise((r) => setTimeout(r, 1)); await select("landing_leads", "tag=4") }),
    ])
    const org = (tag: string) => m.data.find((c) => c.url.includes(`tag=${tag}`))!.url.match(/organization_id=eq\.([0-9a-f-]+)/)![1]
    expect([org("1"), org("2"), org("3"), org("4")]).toEqual([A, A, B, B])
  })

  it("vues : une ligne par organisation, FILTRÉES par le contexte (refusées sans contexte) ; en mode « une organisation » elles restent lues telles quelles", async () => {
    const m = mockDb(multi)
    await runWithOrg(A, () => select("landing_niche_performance", "select=*&order=leads.desc"))
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_niche_performance?select=*&order=leads.desc&organization_id=eq.${A}`)
    await runWithOrg(B, () => select("landing_campaign_performance", "select=*"))
    expect(m.last().url).toContain(`organization_id=eq.${B}`)
    const before = m.data.length
    await expect(select("landing_niche_performance", "select=*")).rejects.toBeInstanceOf(TenantContextError)
    expect(m.data.length).toBe(before)
    resetTenantModeCache()
    const single = mockDb({ status: 200, rows: [{ id: DEFAULT_ORG_ID }] })
    await select("landing_niche_performance", "select=*")
    expect(single.last().url).toBe(`${DB_URL}/rest/v1/landing_niche_performance?select=*`) // fonctionne avant 0010
  })

  it("code promo : la fonction reçoit l'organisation (p_org) du contexte ; une autre organisation est refusée ; avant 0008 (mode off) l'appel ne change pas", async () => {
    const m = mockDb(multi)
    await runWithOrg(B, () => rpc("landing_redeem_promo", { p_code: "RAMADAN27", p_product: "omra" }))
    expect(m.last().body).toEqual({ p_code: "RAMADAN27", p_product: "omra", p_org: B })
    await expect(Promise.resolve(runWithOrg(A, () => rpc("landing_redeem_promo", { p_code: "X", p_product: "omra", p_org: B })))).rejects.toThrow(/organisation différente/)
    await expect(rpc("landing_redeem_promo", { p_code: "X", p_product: "omra" })).rejects.toBeInstanceOf(TenantContextError) // sans contexte : refus
    resetTenantModeCache()
    const single = mockDb({ status: 200, rows: [{ id: DEFAULT_ORG_ID }] })
    await rpc("landing_redeem_promo", { p_code: "X", p_product: "omra" })
    expect(single.last().body).toEqual({ p_code: "X", p_product: "omra", p_org: DEFAULT_ORG_ID })
    resetTenantModeCache()
    const off = mockDb({ status: 404 })
    await rpc("landing_redeem_promo", { p_code: "X", p_product: "omra" })
    expect(off.last().body).toEqual({ p_code: "X", p_product: "omra" })
  })

  it("fonction d'entretien globale (purge des données personnelles) : refusée en mode multi", async () => {
    const m = mockDb(multi)
    await expect(Promise.resolve(runWithOrg(A, () => rpc("landing_purge_personal_data", {})))).rejects.toThrow(/non cloisonnée/)
    expect(m.data.length).toBe(0)
  })

  it("écritures sur intégrations, codes promo, offres, catégories, équipe, protection, blocage : AUTORISÉES en mode multi, toujours dans l'organisation du contexte ; « insérer ou mettre à jour » = (organisation, …)", async () => {
    const m = mockDb(multi)
    await runWithOrg(A, () => upsertQuiet("landing_integrations", { provider: "meta", enabled: true }, "provider"))
    expect(m.last().url).toContain("on_conflict=organization_id,provider")
    expect(m.last().body.organization_id).toBe(A)
    await runWithOrg(B, () => upsertQuiet("landing_blocklist", { kind: "phone", value: "21698000999" }, "kind,value"))
    expect(m.last().url).toContain("on_conflict=organization_id,kind,value")
    expect(m.last().body.organization_id).toBe(B)
    await runWithOrg(A, () => upsertQuiet("landing_integrations", { provider: "tiktok" }, "organization_id,provider")) // déjà complète : pas de doublon de colonne
    expect(m.last().url.match(/organization_id/g)!.length).toBe(1)
    for (const table of ["landing_promo_codes", "landing_offers", "landing_categories", "landing_staff", "landing_integrations"]) {
      await runWithOrg(B, () => insertQuiet(table, { x: 1 }))
      expect(m.last().body.organization_id, table).toBe(B)
    }
    await runWithOrg(A, () => update("landing_protection", "id=eq.1", { allowed_countries: ["TN"] }))
    expect(m.last().url).toBe(`${DB_URL}/rest/v1/landing_protection?id=eq.1&organization_id=eq.${A}`)
  })

  it("deux organisations qui enregistrent EN MÊME TEMPS le même réglage : chacune écrit dans la sienne, sans mélange", async () => {
    const m = mockDb(multi)
    await Promise.all([
      runWithOrg(A, async () => { await new Promise((r) => setTimeout(r, 4)); await upsertQuiet("landing_integrations", { provider: "meta", pixel_id: "AAAAA11111" }, "provider") }),
      runWithOrg(B, async () => { await upsertQuiet("landing_integrations", { provider: "meta", pixel_id: "BBBBB22222" }, "provider") }),
    ])
    const sent = m.data.filter((c) => c.method === "POST").map((c) => `${c.body.pixel_id}:${c.body.organization_id}`).sort()
    expect(sent).toEqual([`AAAAA11111:${A}`, `BBBBB22222:${B}`])
  })

  it("un identifiant d'organisation mal formé est refusé", () => {
    for (const bad of ["", "x", `${A}&organization_id=eq.${B}`, "or=(id.neq.0)"]) expect(() => runWithOrg(bad, () => Promise.resolve())).toThrow(TenantContextError)
  })
})

describe("sonde de détection : robustesse", () => {
  it("la sonde ne force JAMAIS le rendu dynamique : pas de cache « no-store » (sinon /omra et /c/[slug] passent en erreur 500), cache de données Next de 30 s", async () => {
    let probeInit: any = null
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: any = {}) => {
      if (String(url).includes("/rest/v1/organizations?")) { probeInit = init; return new Response(JSON.stringify([{ id: DEFAULT_ORG_ID }]), { status: 200 }) }
      return new Response("[]", { status: 200 })
    }))
    await select("landing_leads", "select=*")
    expect(probeInit).not.toBeNull()
    expect(probeInit.cache).not.toBe("no-store")
    expect(probeInit.next).toEqual({ revalidate: 30 })
  })

  it("panne de la sonde sans mode connu = panne de base (DbError), jamais un accès non cloisonné", async () => {
    mockDb({ status: 500 })
    await expect(select("landing_leads", "select=*")).rejects.toBeInstanceOf(DbError)
  })

  it("panne passagère de la sonde avec mode connu : le dernier mode (même périmé) est conservé — pas de repli vers « off »", async () => {
    vi.useFakeTimers()
    mockDb({ status: 200, rows: [{ id: A }, { id: B }] }) // multi
    await expect(select("landing_leads", "a=1")).rejects.toThrow(TenantContextError)
    vi.advanceTimersByTime(31_000)
    const m = mockDb({ status: 500 }) // la sonde échoue maintenant
    await expect(select("landing_leads", "a=2")).rejects.toThrow(TenantContextError) // toujours multi : refus
    expect(m.data.length).toBe(0)
  })

  it("une réponse de sonde ambiguë (ligne sans identifiant valide) est traitée comme « multi » (refus par défaut)", async () => {
    const m = mockDb({ status: 200, rows: [{ id: "pas-un-uuid" }] })
    await expect(select("landing_leads", "select=*")).rejects.toThrow(TenantContextError)
    expect(m.data.length).toBe(0)
  })
})
