import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { addAdSpend, listAdSpend, voidAdSpend } from "@/lib/server/ad-spend"
import { commitCommissionImport, confirmCommissions, previewCommissionImport } from "@/lib/server/commissions"
import { resetPublicOrgCache, resetTenantModeCache, runWithOrg } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const BOB = "00000000-0000-4000-8000-0000000000b0"
interface Row { [k: string]: unknown }
let spend: Row[], coms: Row[], leads: Row[], seq: number, absent = false

const orgOf = (dec: string) => dec.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
beforeEach(() => {
  configureAll()
  resetTenantModeCache(); resetPublicOrgCache()
  spend = []; coms = []; seq = 0; absent = false
  leads = [
    { id: "lead-e1", ref: "E2B-ABC234", first_name: "Sami", phone: "21698140514", organization_id: E2B },
    { id: "lead-e2", ref: "E2B-DEF567", first_name: "Amel", phone: "21622123456", organization_id: E2B },
    { id: "lead-e3", ref: "E2B-GHJ789", first_name: "Doublon", phone: "21655000111", organization_id: E2B },
    { id: "lead-e4", ref: "E2B-KMN234", first_name: "Doublon2", phone: "21655000111", organization_id: E2B },
    { id: "lead-b1", ref: "E2B-BOB234", first_name: "Bob", phone: "21699999999", organization_id: BOB },
  ]
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const dec = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (dec.includes("/rest/v1/organizations?")) return json(dec.includes("slug=eq.easy2book") ? [{ id: E2B }] : [{ id: E2B }, { id: BOB }])
    const table = dec.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    if (absent && (table === "landing_ad_spend" || table === "landing_commissions")) return json({ code: "42P01" }, 404)
    const org = orgOf(dec)
    const method = init.method ?? "GET"
    if (method === "POST") {
      const b = JSON.parse(String(init.body))
      if (table === "landing_ad_spend") {
        if (b.voids_id && spend.some((s) => s.voids_id === b.voids_id)) return json({ code: "23505" }, 409)
        const row = { id: ++seq, ...b }; spend.push(row); return json([row], 201)
      }
      if (table === "landing_commissions") {
        if (coms.some((c) => c.organization_id === b.organization_id && c.line_key === b.line_key)) return json({ code: "23505" }, 409)
        const lead = leads.find((l) => l.id === b.lead_id)
        if (!lead || lead.organization_id !== b.organization_id) return json({ code: "P0001", message: "autre entreprise" }, 400)
        const row = { id: ++seq, status: "provisoire", ...b }; coms.push(row); return json([row], 201)
      }
      return json([], 201)
    }
    if (method === "PATCH") {
      const id = Number(dec.match(/id=eq\.(\d+)/)?.[1])
      const body = JSON.parse(String(init.body))
      const hit = coms.filter((c) => c.id === id && c.organization_id === org && c.status === "provisoire")
      hit.forEach((c) => Object.assign(c, body))
      return json(hit)
    }
    const inVals = (col: string) => { const m = dec.match(new RegExp(`${col}=in\\.\\((.*?)\\)(?:&|$)`)); return m ? m[1].split(",").map((x) => x.replace(/"/g, "")) : null }
    const idEq = dec.match(/[?&]id=eq\.(\d+)/)?.[1]
    if (table === "landing_ad_spend") {
      let rows = spend.filter((s) => s.organization_id === org)
      if (idEq) rows = rows.filter((s) => String(s.id) === idEq)
      const v = dec.match(/voids_id=eq\.(\d+)/)?.[1]
      if (v) rows = rows.filter((s) => String(s.voids_id) === v)
      return json(rows)
    }
    if (table === "landing_commissions") {
      const or = dec.match(/or=\((.*)\)/)
      let rows = coms.filter((c) => c.organization_id === org)
      if (or) {
        const keys = (or[1].match(/line_key\.in\.\((.*?)\),external_ref/)?.[1] ?? "").split(",").map((x) => x.replace(/"/g, ""))
        const refs = (or[1].match(/external_ref\.in\.\((.*?)\)$/)?.[1] ?? "").split(",").map((x) => x.replace(/"/g, ""))
        rows = rows.filter((c) => keys.includes(String(c.line_key)) || refs.includes(String(c.external_ref)))
      }
      return json(rows)
    }
    if (table === "landing_leads") {
      let rows = leads.filter((l) => l.organization_id === org)
      const refs = inVals("ref"), phones = inVals("phone"), ids = inVals("id")
      if (refs) rows = rows.filter((l) => refs.includes(String(l.ref)))
      if (phones) rows = rows.filter((l) => phones.includes(String(l.phone)))
      if (ids) rows = rows.filter((l) => ids.includes(String(l.id)))
      return json(rows)
    }
    return json([])
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const as = <T,>(org: string, fn: () => Promise<T>) => runWithOrg(org, fn) as Promise<T>
const H = "reservation_ref;nature;montant_tnd;date;lead_ref;telephone;ligne"
const today = new Date().toISOString().slice(0, 10)

describe("dépenses publicitaires (saisie manuelle, ajout seul)", () => {
  const ok = { date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount: "250,5", reference: "Facture 12" }
  it("enregistre une dépense manuelle dans l'entreprise du contexte, jamais celle d'un formulaire", async () => {
    expect(await as(BOB, () => addAdSpend(ok, "u1"))).toEqual({ ok: true })
    expect(spend[0]).toMatchObject({ organization_id: BOB, spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: 250.5, source: "manuel", reference: "Facture 12", created_by: "u1" })
    expect((await as(E2B, () => listAdSpend())).rows).toHaveLength(0)
    expect((await as(BOB, () => listAdSpend())).rows).toHaveLength(1)
  })

  it("validation : date, réseau, campagne, montant ; date future refusée", async () => {
    const r = await as(E2B, () => addAdSpend({ date: "2999-01-01", network: "google", campaign: "  ", amount: "0" }, null))
    expect(r).toMatchObject({ ok: false, errors: { date: expect.any(String), network: expect.any(String), campaign: expect.any(String), amount: expect.any(String) } })
    expect(await as(E2B, () => addAdSpend({ ...ok, date: "2026-02-30" }, null))).toMatchObject({ ok: false, errors: { date: expect.any(String) } })
    expect(await as(E2B, () => addAdSpend({ ...ok, date: today }, null))).toEqual({ ok: true })
    expect(spend).toHaveLength(1)
  })

  it("annulation : écriture opposée exacte ; une dépense annulée ne s'annule pas deux fois ; une annulation ne s'annule pas", async () => {
    await as(E2B, () => addAdSpend(ok, null))
    expect(await as(E2B, () => voidAdSpend(1, "u1"))).toEqual({ ok: true })
    expect(spend[1]).toMatchObject({ amount_tnd: -250.5, voids_id: 1, campaign: "Omra 2027", spend_date: "2026-11-05" })
    expect(await as(E2B, () => voidAdSpend(1, null))).toMatchObject({ ok: false, message: expect.stringMatching(/déjà annulée/) })
    expect(await as(E2B, () => voidAdSpend(2, null))).toMatchObject({ ok: false, message: expect.stringMatching(/ne s'annule pas/) })
    expect(await as(E2B, () => voidAdSpend(999, null))).toMatchObject({ ok: false })
    expect(spend).toHaveLength(2)
  })

  it("une entreprise ne peut pas annuler la dépense d'une autre", async () => {
    await as(E2B, () => addAdSpend(ok, null))
    expect(await as(BOB, () => voidAdSpend(1, null))).toMatchObject({ ok: false, message: expect.stringMatching(/inconnue/) })
    expect(spend).toHaveLength(1)
  })

  it("migration 0016 non appliquée : message clair, lecture vide", async () => {
    absent = true
    expect(await as(E2B, () => addAdSpend(ok, null))).toMatchObject({ ok: false, message: expect.stringMatching(/0016/) })
    expect(await as(E2B, () => listAdSpend())).toEqual({ rows: [], migrationApplied: false })
  })
})

describe("import des commissions EasyV4", () => {
  it("aperçu : rapprochement par référence de dossier, par téléphone (à valider), ambigu, introuvable, erreurs de ligne", async () => {
    const csv = [H, "R1;commission;500;2026-11-08;E2B-ABC234;;", "R2;commission;300;2026-11-08;;98 140 514;", "R3;commission;200;2026-11-08;;55 000 111;", "R4;commission;200;2026-11-08;E2B-ZZZ999;;", "R5;commission;abc;2026-11-08;E2B-ABC234;;"].join("\n")
    const p = await as(E2B, () => previewCommissionImport(csv))
    expect(p.rows.map((r) => [r.reservationRef, r.status])).toEqual([["R1", "rapproche"], ["R2", "a_valider"], ["R3", "ambigu"], ["R4", "introuvable"]])
    expect(p.errors).toHaveLength(1)
    expect(p.rows[0]).toMatchObject({ leadRef: "E2B-ABC234", firstName: "Sami" })
    expect(p.counts).toMatchObject({ rapproche: 1, a_valider: 1, ambigu: 1, introuvable: 1 })
  })

  it("import : seules les lignes rapprochées par référence ET les rapprochements par téléphone validés sont enregistrées, toujours « provisoire »", async () => {
    const csv = [H, "R1;commission;500;2026-11-08;E2B-ABC234;;", "R2;commission;300;2026-11-08;;22 123 456;", "R3;commission;200;2026-11-08;;55 000 111;", "R4;commission;100;2026-11-08;E2B-ZZZ999;;"].join("\n")
    const none = await as(E2B, () => commitCommissionImport(csv, [], "u1"))
    expect(none).toMatchObject({ imported: 1, skipped: 3 })
    expect(coms).toHaveLength(1)
    const withValidation = await as(E2B, () => commitCommissionImport(csv, ["R2|commission|1", "R3|commission|1"], "u1"))
    expect(withValidation).toMatchObject({ imported: 1, duplicates: 1, skipped: 2 }) // R3 ambigu : jamais importé, même « validé »
    expect(coms.map((c) => c.external_ref).sort()).toEqual(["R1", "R2"])
    expect(coms.every((c) => c.status === "provisoire" && c.source === "import_csv" && c.created_by === "u1" && String(c.import_batch).startsWith("import-"))).toBe(true)
    expect(coms.find((c) => c.external_ref === "R2")).toMatchObject({ lead_id: "lead-e2", amount_tnd: 300, kind: "commission", event_date: "2026-11-08", organization_id: E2B })
  })

  it("idempotence : réimporter le même fichier ne crée aucun doublon", async () => {
    const csv = [H, "R1;commission;500;2026-11-08;E2B-ABC234;;"].join("\n")
    await as(E2B, () => commitCommissionImport(csv, [], null))
    const again = await as(E2B, () => commitCommissionImport(csv, [], null))
    expect(again).toMatchObject({ imported: 0, duplicates: 1 })
    expect(coms).toHaveLength(1)
  })

  it("annulation et remboursement enregistrés en lignes négatives ; avertissement si la commission d'origine est inconnue", async () => {
    const p = await as(E2B, () => previewCommissionImport([H, "R9;annulation;500;2026-11-09;E2B-ABC234;;"].join("\n")))
    expect(p.rows[0].warning).toMatch(/Aucune commission connue/)
    const csv = [H, "R1;commission;500;2026-11-08;E2B-ABC234;;", "R1;annulation;500;2026-11-09;E2B-ABC234;;", "R1;remboursement;50;2026-11-10;E2B-ABC234;;"].join("\n")
    await as(E2B, () => commitCommissionImport(csv, [], null))
    expect(coms.map((c) => [c.kind, c.amount_tnd])).toEqual([["commission", 500], ["annulation", -500], ["remboursement", -50]])
  })

  it("une réservation EasyV4 ne peut pas être rattachée à deux dossiers différents", async () => {
    await as(E2B, () => commitCommissionImport([H, "R1;commission;500;2026-11-08;E2B-ABC234;;"].join("\n"), [], null))
    const p = await as(E2B, () => previewCommissionImport([H, "R1;remboursement;50;2026-11-10;E2B-DEF567;;"].join("\n")))
    expect(p.rows[0].status).toBe("conflit")
    const same = await as(E2B, () => previewCommissionImport([H, "R7;commission;50;2026-11-10;E2B-ABC234;;", "R7;remboursement;10;2026-11-11;E2B-DEF567;;"].join("\n")))
    expect(same.rows.map((r) => r.status)).toEqual(["rapproche", "conflit"])
  })

  it("isolation : la référence d'un dossier d'une AUTRE entreprise reste introuvable ; aucune ligne n'est écrite chez elle", async () => {
    const csv = [H, "R1;commission;500;2026-11-08;E2B-BOB234;;"].join("\n")
    const p = await as(E2B, () => previewCommissionImport(csv))
    expect(p.rows[0].status).toBe("introuvable")
    expect(await as(E2B, () => commitCommissionImport(csv, [], null))).toMatchObject({ imported: 0, skipped: 1 })
    expect(coms).toHaveLength(0)
    expect(await as(BOB, () => commitCommissionImport(csv, [], null))).toMatchObject({ imported: 1 })
    expect(coms[0]).toMatchObject({ organization_id: BOB, lead_id: "lead-b1" })
  })

  it("confirmation : provisoire → confirmé une seule fois, dans SON entreprise seulement", async () => {
    await as(E2B, () => commitCommissionImport([H, "R1;commission;500;2026-11-08;E2B-ABC234;;"].join("\n"), [], null))
    const id = Number(coms[0].id)
    expect(await as(BOB, () => confirmCommissions([id], "u2"))).toEqual({ confirmed: 0, failed: 0 })
    expect(coms[0].status).toBe("provisoire")
    expect(await as(E2B, () => confirmCommissions([id], "u1"))).toEqual({ confirmed: 1, failed: 0 })
    expect(coms[0]).toMatchObject({ status: "confirme", confirmed_by: "u1" })
    expect(await as(E2B, () => confirmCommissions([id], "u1"))).toEqual({ confirmed: 0, failed: 0 })
  })

  it("migration 0016 non appliquée : aperçu et import l'indiquent sans rien écrire", async () => {
    absent = true
    const csv = [H, "R1;commission;500;2026-11-08;E2B-ABC234;;"].join("\n")
    expect((await as(E2B, () => previewCommissionImport(csv))).migrationApplied).toBe(false)
    expect(await as(E2B, () => commitCommissionImport(csv, [], null))).toMatchObject({ imported: 0, message: expect.stringMatching(/0016/) })
  })
})
