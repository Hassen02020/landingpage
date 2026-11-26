// Conversations (migration 0029). Jeux de données FICTIFS, aucun appel réseau réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { NEW_CONVERSATION_AFTER_DAYS, deriveStage, needsNewConversation, rate, summarize, validateIndividual, validateLot } from "@/lib/conversations"
import { cancelConversation, createIndividual, createLot, listConversations, type ConvActor } from "@/lib/server/conversations"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

type Row = Record<string, any>
const DB = "https://landing-db.test"
const LEAD_ID = "11111111-1111-4111-8111-111111111111"
const COLLEAGUE = "22222222-2222-4222-8222-222222222222"
const ME = "33333333-3333-4333-8333-333333333333"
let convs: Row[], leads: Row[], adminLog: Row[], methods: string[], urls: string[], tableUnavailable: boolean, seq: number

function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = decodeURIComponent(String(url)), method = (init.method || "GET").toUpperCase()
    urls.push(u); methods.push(method)
    if (u.includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
    const table = u.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ""
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (table === "landing_conversations") {
      if (tableUnavailable) return new Response(JSON.stringify({ code: "42P01" }), { status: 404 })
      if (method === "POST") { const row = { id: ++seq, status: "ouverte", started_at: new Date().toISOString(), ...body }; convs.push(row); return new Response(JSON.stringify([row]), { status: 201 }) }
      if (method === "PATCH") { const id = Number(u.match(/id=eq\.(\d+)/)?.[1]); convs.filter((r) => r.id === id).forEach((r) => Object.assign(r, body)); return new Response("[]", { status: 200 }) }
      const id = u.match(/id=eq\.(\d+)/)?.[1]
      return new Response(JSON.stringify(id ? convs.filter((r) => r.id === Number(id)) : convs), { status: 200 })
    }
    if (table === "landing_leads") { const id = u.match(/id=eq\.([0-9a-f-]+)/)?.[1]; return new Response(JSON.stringify(id ? leads.filter((l) => l.id === id) : leads), { status: 200 }) }
    if (table === "landing_admin_log") { adminLog.push(body); return new Response(null, { status: 201 }) }
    return new Response("[]", { status: 200 })
  }))
}
const actor = (role: ConvActor["role"], id = ME): ConvActor => ({ id, label: "equipe@exemple.test", role })
beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache()
  convs = []; leads = [{ id: LEAD_ID, ref: "E2B-ABC123", status: "contacte", assigned_to: COLLEAGUE, phone: "21698140514", first_name: "Sana", anonymized_at: null }]
  adminLog = []; methods = []; urls = []; tableUnavailable = false; seq = 0
  vi.stubEnv("LANDING_SUPABASE_URL", DB); stub()
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("règles pures", () => {
  it("lot : nombre 1–1000, canal et origine contrôlés, date non future ; aucun champ personnel", () => {
    const now = new Date("2026-11-22T10:00:00Z")
    expect(validateLot({ channel: "whatsapp", origin: "annonce", count: "12", day: "2026-11-22" }, now)).toMatchObject({ ok: true, value: { kind: "lot", conversation_count: 12 } })
    for (const count of ["0", "1001", "2.5", "abc", ""]) expect(validateLot({ channel: "whatsapp", origin: "annonce", count }, now).ok).toBe(false)
    expect(validateLot({ channel: "sms", origin: "annonce", count: 3 }, now).ok).toBe(false)
    expect(validateLot({ channel: "whatsapp", origin: "pub", count: 3 }, now).ok).toBe(false)
    expect(validateLot({ channel: "whatsapp", origin: "annonce", count: 3, day: "2026-12-30" }, now).ok).toBe(false)
    expect(validateLot({ channel: "whatsapp", origin: "annonce", count: 3, day: "2024-01-01" }, now).ok).toBe(false)
    const v = validateLot({ channel: "instagram", origin: "organique", count: 4 }, now)
    expect(v.ok && Object.keys(v.value).some((k) => /phone|name|email|text|lead/i.test(k))).toBe(false)
  })
  it("individuelle : une seule conversation, fiche facultative et valide", () => {
    expect(validateIndividual({ channel: "messenger", origin: "annonce" })).toMatchObject({ ok: true, value: { conversation_count: 1, lead_id: null } })
    expect(validateIndividual({ channel: "messenger", origin: "annonce", leadId: "pas-un-uuid" }).ok).toBe(false)
    expect(validateIndividual({ channel: "telephone", origin: "direct", leadId: LEAD_ID })).toMatchObject({ ok: true, value: { lead_id: LEAD_ID } })
  })
  it("nouvelle conversation après 30 jours sans échange", () => {
    const now = new Date("2026-11-22T00:00:00Z"), d = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000).toISOString()
    expect(NEW_CONVERSATION_AFTER_DAYS).toBe(30)
    expect(needsNewConversation(d(29), now)).toBe(false)
    expect(needsNewConversation(d(31), now)).toBe(true)
    expect(needsNewConversation(null, now)).toBe(true)
  })
  it("étape déduite : sans fiche = conversation seule ; vente = réservé ou gagné ; une conversation n'est pas un prospect", () => {
    expect(deriveStage(null)).toBe("conversation")
    expect(deriveStage("nouveau")).toBe("prospect")
    expect(deriveStage("qualifie")).toBe("qualifie")
    expect(deriveStage("negociation")).toBe("devis")
    expect(deriveStage("reserve")).toBe("vendu")
    expect(deriveStage("gagne")).toBe("vendu")
    expect(deriveStage("perdu")).toBe("perdu")
    expect(deriveStage("inconnu")).toBe("conversation")
  })
  it("compteurs : un lot ne crée ni prospect ni vente ; une conversation annulée est exclue ; plusieurs conversations sur une fiche", () => {
    const s = summarize([
      { kind: "lot", status: "ouverte", conversation_count: 20, has_lead: false },
      { kind: "individuelle", status: "ouverte", conversation_count: 1, has_lead: false },
      { kind: "individuelle", status: "ouverte", conversation_count: 1, has_lead: true, lead_status: "reserve" },
      { kind: "individuelle", status: "ouverte", conversation_count: 1, has_lead: true, lead_status: "reserve" }, // 2e conversation de la même fiche
      { kind: "individuelle", status: "annulee", conversation_count: 1, has_lead: true, lead_status: "qualifie" },
      { kind: "lot", status: "annulee", conversation_count: 50, has_lead: false },
    ])
    expect(s.conversations).toBe(23)
    expect(s.conversationSeule).toBe(21)
    expect(s.prospects).toBe(2)
    expect(s.ventes).toBe(2)
  })
  it("taux : null sous le seuil d'échantillon", () => { expect(rate(1, 4)).toBeNull(); expect(rate(2, 10)).toBe(20) })
})

describe("saisie côté serveur", () => {
  it("lot : enregistré avec l'auteur, sans aucune donnée personnelle, journal d'audit écrit", async () => {
    const r = await createLot(actor("employee"), { channel: "whatsapp", origin: "annonce", campaign: "omra-ramadan-2027-fb", count: "15" })
    expect(r.ok).toBe(true)
    expect(convs).toHaveLength(1)
    expect(convs[0]).toMatchObject({ kind: "lot", conversation_count: 15, created_by: ME, updated_by: ME, source_kind: "saisie" })
    expect(convs[0]).not.toHaveProperty("lead_id", expect.anything())
    expect(JSON.stringify(convs[0])).not.toMatch(/2169|Sana|phone/)
    expect(adminLog[0]).toMatchObject({ area: "conversations", actor_id: ME })
    expect(JSON.stringify(adminLog)).not.toMatch(/2169|Sana/)
  })
  it("lot invalide : rien n'est écrit", async () => {
    const r = await createLot(actor("employee"), { channel: "whatsapp", origin: "annonce", count: "0" })
    expect(r.ok).toBe(false); expect(convs).toHaveLength(0)
  })
  it("DROITS : un employé ne peut pas relier une conversation à la fiche d'un collègue ; un manager le peut ; la fiche d'une autre entreprise est introuvable", async () => {
    const input = { channel: "whatsapp", origin: "annonce", leadId: LEAD_ID }
    const emp = await createIndividual(actor("employee"), input)
    expect(emp.ok).toBe(false); expect(convs).toHaveLength(0)
    expect((await createIndividual(actor("manager"), input)).ok).toBe(true)
    expect((await createIndividual(actor("admin"), input)).ok).toBe(true)
    expect(convs).toHaveLength(2)
    expect(convs[0]).toMatchObject({ kind: "individuelle", lead_id: LEAD_ID, created_by: ME })
    expect(convs[0]).not.toHaveProperty("contact_phone"); expect(JSON.stringify(convs[0])).not.toMatch(/2169|Sana/)
    leads = [] // la base cloisonnée ne renvoie pas la fiche d'une autre entreprise
    const other = await createIndividual(actor("admin"), input)
    expect(other).toMatchObject({ ok: false, errors: { leadId: expect.any(String) } })
  })
  it("un employé peut relier une conversation à SA fiche seulement (Q8-A : pas de fiche non affectée) ; fiche anonymisée refusée", async () => {
    leads[0].assigned_to = ME
    expect((await createIndividual(actor("employee"), { channel: "instagram", origin: "organique", leadId: LEAD_ID })).ok).toBe(true)
    leads[0].assigned_to = null
    expect((await createIndividual(actor("employee"), { channel: "instagram", origin: "organique", leadId: LEAD_ID })).ok).toBe(false)
    expect((await createIndividual(actor("manager"), { channel: "instagram", origin: "organique", leadId: LEAD_ID })).ok).toBe(true)
    leads[0].anonymized_at = "2026-11-01T00:00:00Z"
    expect((await createIndividual(actor("admin"), { channel: "instagram", origin: "organique", leadId: LEAD_ID })).ok).toBe(false)
  })
  it("annulation : la ligne reste (statut « annulee », auteur tracé), AUCUNE requête DELETE", async () => {
    await createLot(actor("employee"), { channel: "whatsapp", origin: "annonce", count: "3" })
    expect((await cancelConversation(actor("employee"), 1)).ok).toBe(true)
    expect(convs).toHaveLength(1)
    expect(convs[0]).toMatchObject({ status: "annulee", updated_by: ME })
    expect(methods).not.toContain("DELETE")
  })
  it("annulation : un autre employé ne peut pas annuler la saisie d'un collègue ; un manager le peut", async () => {
    await createLot(actor("employee"), { channel: "whatsapp", origin: "annonce", count: "3" })
    expect((await cancelConversation(actor("employee", COLLEAGUE), 1)).ok).toBe(false)
    expect(convs[0].status).toBe("ouverte")
    expect((await cancelConversation(actor("manager", COLLEAGUE), 1)).ok).toBe(true)
  })
  it("annulation d'une conversation reliée à la fiche d'un collègue : refusée à un employé", async () => {
    convs.push({ id: ++seq, kind: "individuelle", lead_id: LEAD_ID, created_by: COLLEAGUE, status: "ouverte" })
    expect((await cancelConversation(actor("employee"), 1)).ok).toBe(false)
    expect(convs[0].status).toBe("ouverte")
  })
  it("migration 0029 non appliquée : message clair, aucune exception", async () => {
    tableUnavailable = true
    expect(await createLot(actor("employee"), { channel: "whatsapp", origin: "annonce", count: "3" })).toMatchObject({ ok: false, message: expect.stringContaining("0029") })
    expect((await listConversations()).tableMissing).toBe(true)
  })
})

describe("lecture", () => {
  it("la liste ne contient aucun numéro ni nom, et ne les demande pas à la base ; l'étape est déduite de la fiche", async () => {
    leads[0].status = "reserve"
    convs.push({ id: ++seq, kind: "individuelle", channel: "whatsapp", origin: "annonce", campaign: null, conversation_count: 1, lead_id: LEAD_ID, status: "ouverte", started_at: new Date().toISOString(), created_by: ME, anonymized_at: null })
    convs.push({ id: ++seq, kind: "lot", channel: "whatsapp", origin: "annonce", campaign: null, conversation_count: 9, lead_id: null, status: "ouverte", started_at: new Date().toISOString(), created_by: ME, anonymized_at: null })
    const { rows, stats } = await listConversations()
    expect(JSON.stringify(rows)).not.toMatch(/2169|Sana|phone|first_name/)
    expect(rows.find((r) => r.kind === "individuelle")?.stage).toBe("vendu")
    expect(rows.find((r) => r.kind === "lot")?.stage).toBe("conversation")
    expect(stats).toMatchObject({ conversations: 10, prospects: 1, ventes: 1, conversationSeule: 9 })
    const leadReq = urls.find((u) => u.includes("/rest/v1/landing_leads"))!
    expect(leadReq).toContain("select=id,status"); expect(leadReq).not.toMatch(/phone|first_name/)
  })
})
