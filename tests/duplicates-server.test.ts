// Doublons de dossiers — serveur : signaler / confirmer / rejeter / rouvrir, droits, cloisonnement, exclusion des chiffres,
// contrôle « une réservation = une vente = un Purchase », Purchase retenu / libéré, notes préservées.
// Jeux de données FICTIFS ; base et Meta simulés en mémoire ; aucun appel réseau réel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
import { candidatesFor, decideDuplicate, flagDuplicate, listReviews, reopenDuplicate, reviewsForLead, type DupActor } from "@/lib/server/duplicates"
import { changeStatus, type LeadRow } from "@/lib/server/crm"
import { loadAllCustomers } from "@/lib/server/customer"
import { retryConversions } from "@/lib/server/conversions"
import { __resetLeadScope, selectRealLeads } from "@/lib/server/lead-scope"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

type Row = Record<string, any>
const DB = "https://landing-db.test"
const T = Date.parse("2026-11-20T10:00:00Z")
const iso = (ms: number) => new Date(T + ms).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const PHONE = "21622000001", FIRST_NAME = "Sana"
const EMP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", COLLEAGUE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", MGR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", MGR2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", ADM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"
const actor = (role: DupActor["role"], id: string): DupActor => ({ id, label: `${role}@exemple.test`, role })

let t: Record<string, Row[]>, calls: { method: string; table: string; url: string; body?: any }[], metaEvents: string[], leadsReadFails: boolean, seq: number
const metaPurchases = () => metaEvents.filter((e) => e === "Purchase").length // « Lead qualifié » part aussi au passage à « réservé » : seul Purchase compte ici

const matchRow = (row: Row, params: URLSearchParams): boolean => {
  for (const [k, raw] of params) {
    if (["select", "limit", "order", "offset"].includes(k)) continue
    if (k === "or") {
      const alts = raw.replace(/^\(|\)$/g, "").split(",").map((a) => a.split("."))
      if (!alts.some(([col, op, ...v]) => op === "eq" && String(row[col]) === v.join("."))) return false
      continue
    }
    const m = /^(not\.)?(eq|neq|is|in|like)\.(.*)$/.exec(raw)
    if (!m) continue
    const [, not, op, val] = m
    const cell = row[k] === undefined && k === "is_test" ? false : row[k]
    let ok = true
    if (op === "eq") ok = String(cell) === val
    else if (op === "neq") ok = String(cell) !== val
    else if (op === "is") ok = val === "null" ? cell === null || cell === undefined : String(cell) === val
    else if (op === "in") ok = val.replace(/^\(|\)$/g, "").split(",").includes(String(cell))
    else if (op === "like") ok = new RegExp(`^${val.replace(/\*/g, ".*")}$`).test(String(cell ?? ""))
    if (not) ok = !ok
    if (!ok) return false
  }
  return true
}

function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url), method = (init.method || "GET").toUpperCase()
    if (u.includes("graph.facebook.com")) { metaEvents.push(String(JSON.parse(String(init.body ?? "{}"))?.data?.[0]?.event_name ?? "?")); return new Response(JSON.stringify({ events_received: 1 }), { status: 200 }) }
    if (u.includes("business-api.tiktok.com")) return new Response(JSON.stringify({ code: 0 }), { status: 200 })
    const dec = decodeURIComponent(u)
    if (dec.includes("/rest/v1/organizations?")) return new Response("[]", { status: 200 })
    const m = /\/rest\/v1\/([a-z_]+)(?:\?(.*))?$/.exec(dec)
    const table = m?.[1] ?? "", params = new URLSearchParams(m?.[2] ?? "")
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, table, url: dec, body })
    if (!(table in t)) return new Response(JSON.stringify({ code: "42P01" }), { status: 404 })
    if (method === "GET") {
      if (table === "landing_leads" && leadsReadFails && !params.get("id")?.startsWith("eq.")) return new Response(JSON.stringify({ code: "XX000", message: "panne" }), { status: 500 })
      const lim = Number(params.get("limit") ?? 1000)
      return new Response(JSON.stringify(t[table].filter((r) => matchRow(r, params)).slice(0, lim)), { status: 200 })
    }
    if (method === "POST") {
      if (table === "landing_conversion_log" && t[table].some((r) => r.event_id === body.event_id)) return new Response(JSON.stringify({ code: "23505" }), { status: 409 })
      const row = { id: ++seq, created_at: new Date().toISOString(), ...(table === "landing_duplicate_reviews" ? { status: "signale", decided_by: null, decided_at: null, decision_note: null, purchase_state: null, reported_at: new Date().toISOString() } : {}), ...body }
      t[table].push(row)
      return new Response(JSON.stringify([row]), { status: 201 })
    }
    if (method === "PATCH") {
      const hit = t[table].filter((r) => matchRow(r, params))
      hit.forEach((r) => {
        const before = r.status
        Object.assign(r, body)
        if (table === "landing_duplicate_reviews") { // simule le déclencheur de synchronisation de la migration 0030
          const lead = t.landing_leads.find((l) => l.id === r.lead_id)
          if (lead && r.status === "confirme" && before !== "confirme") { lead.duplicate_of = r.primary_lead_id; lead.duplicate_confirmed_at = r.decided_at }
          if (lead && before === "confirme" && r.status !== "confirme") { lead.duplicate_of = null; lead.duplicate_confirmed_at = null }
        }
      })
      return new Response(JSON.stringify(hit), { status: 200 })
    }
    return new Response("{}", { status: 200 })
  }))
}

let n = 0
const lead = (o: Row = {}): LeadRow => {
  const row = { id: uuid(++n), ref: `E2B-T${String(n).padStart(5, "0")}`, first_name: FIRST_NAME, last_name: null, phone: PHONE, product: "omra", offer: "الفوج الأول", offer_id: null, travel_date: null, status: "contacte", assigned_to: null,
    created_at: iso(0), tracking_consent: true, marketing_consent: true, booking_value: null, booked_at: null, notes: null, is_test: false, anonymized_at: null, duplicate_of: null, region: "Tunis", ...o } as unknown as LeadRow
  t.landing_leads.push(row as Row)
  return row
}
const get = (id: string) => t.landing_leads.find((l) => l.id === id)!
const writes = (table: string) => calls.filter((c) => c.table === table && c.method !== "GET")

beforeEach(() => {
  configureAll(); resetTenantModeCache(); resetPublicOrgCache(); __resetLeadScope()
  t = { landing_leads: [], landing_duplicate_reviews: [], landing_lead_activities: [], landing_admin_log: [], landing_conversion_log: [], landing_commissions: [], landing_variable_costs: [] }
  calls = []; metaEvents = []; leadsReadFails = false; seq = 100
  vi.stubEnv("LANDING_SUPABASE_URL", DB); stub()
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("signaler", () => {
  it("un conseiller signale un doublon sur SON dossier : signalement créé (règle technique, confiance élevée), activité et journal sans donnée personnelle, statut du dossier inchangé", async () => {
    const prim = lead({ created_at: iso(0), assigned_to: EMP }), cand = lead({ created_at: iso(5 * 60_000), assigned_to: EMP })
    const r = await flagDuplicate(actor("employee", EMP), { leadId: cand.id, primaryLeadId: prim.id, reason: "même demande envoyée deux fois" })
    expect(r.ok).toBe(true)
    expect(t.landing_duplicate_reviews).toHaveLength(1)
    expect(t.landing_duplicate_reviews[0]).toMatchObject({ lead_id: cand.id, primary_lead_id: prim.id, rule: "technique_15min", confidence: "elevee", status: "signale", reported_by: EMP })
    expect(t.landing_lead_activities.map((a) => a.type)).toEqual(["duplicate_flagged"])
    expect(t.landing_admin_log[0]).toMatchObject({ area: "doublons", actor_id: EMP })
    expect(JSON.stringify([t.landing_lead_activities, t.landing_admin_log])).not.toMatch(new RegExp(`${PHONE}|${FIRST_NAME}`))
    expect(get(cand.id).status).toBe("contacte"); expect(get(cand.id).duplicate_of).toBeNull() // signalé ≠ confirmé
    expect(writes("landing_leads")).toHaveLength(0) // aucune écriture sur les dossiers
  })
  it("règle commerciale (30 jours) ; intérêt renouvelé au-delà : rapprochement manuel de confiance faible, jamais présenté comme règle automatique", async () => {
    const prim = lead({ created_at: iso(0) }), cand = lead({ created_at: iso(10 * 86_400_000) }), far = lead({ created_at: iso(60 * 86_400_000), product: "omra" })
    await flagDuplicate(actor("manager", MGR), { leadId: cand.id, primaryLeadId: prim.id })
    await flagDuplicate(actor("manager", MGR), { leadId: far.id, primaryLeadId: prim.id })
    expect(t.landing_duplicate_reviews.map((r) => [r.rule, r.confidence])).toEqual([["commerciale_30j", "elevee"], ["manuel", "faible"]])
  })
  it("SÉCURITÉ : un conseiller ne signale pas sur le dossier d'un collègue ; autre téléphone, soi-même, dossier introuvable, identifiant malveillant, anonymisé, déjà confirmé : refusés, rien d'écrit", async () => {
    const a = lead({ assigned_to: COLLEAGUE }), b = lead({ assigned_to: COLLEAGUE }), other = lead({ phone: "21622000002", assigned_to: EMP }), anon = lead({ anonymized_at: iso(0), assigned_to: EMP }), mine = lead({ assigned_to: EMP }), dupd = lead({ assigned_to: EMP, duplicate_of: a.id })
    const e = actor("employee", EMP)
    expect((await flagDuplicate(e, { leadId: a.id, primaryLeadId: b.id })).ok).toBe(false) // dossier d'un collègue
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: other.id })).ok).toBe(false) // autre téléphone
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: mine.id })).ok).toBe(false) // soi-même
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: uuid(9999) })).ok).toBe(false) // introuvable (autre entreprise : même résultat)
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: "x'; drop table landing_leads;--" })).ok).toBe(false) // identifiant malveillant
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: anon.id })).ok).toBe(false) // anonymisé
    expect((await flagDuplicate(e, { leadId: mine.id, primaryLeadId: dupd.id })).ok).toBe(false) // déjà confirmé doublon
    expect(t.landing_duplicate_reviews).toHaveLength(0); expect(t.landing_lead_activities).toHaveLength(0)
  })
  it("migration 0030 non appliquée : message clair, aucune exception", async () => {
    delete (t as Row).landing_duplicate_reviews
    const a = lead({ assigned_to: EMP }), b = lead({ assigned_to: EMP })
    expect(await flagDuplicate(actor("employee", EMP), { leadId: a.id, primaryLeadId: b.id })).toMatchObject({ ok: false, error: expect.stringContaining("0030") })
    expect((await reviewsForLead(a.id))).toEqual([]); expect((await listReviews("signale")).tableMissing).toBe(true)
  })
  it("candidats : détectés par calcul (non examinés) avec règle et confiance ; sans offre comparable : confiance faible", async () => {
    const a = lead({ created_at: iso(0), offer: null }), b = lead({ created_at: iso(3 * 60_000), offer: null })
    const c = await candidatesFor(b)
    expect(c[0]).toMatchObject({ otherId: a.id, rule: "technique_15min", confidence: "faible" })
  })
})

describe("confirmer, rejeter, rouvrir : droits (D1, D2)", () => {
  const setup = async () => {
    const prim = lead({ created_at: iso(0), assigned_to: EMP }), cand = lead({ created_at: iso(60_000), assigned_to: EMP })
    await flagDuplicate(actor("manager", MGR), { leadId: cand.id, primaryLeadId: prim.id })
    return { prim, cand, review: t.landing_duplicate_reviews[0] }
  }
  it("D1 : le signaleur (même Manager ou Admin) ne décide JAMAIS son propre signalement ; un conseiller ne décide pas ; un autre Manager oui", async () => {
    const { review } = await setup()
    expect((await decideDuplicate(actor("manager", MGR), review.id, "confirme")).ok).toBe(false)
    expect((await decideDuplicate(actor("employee", EMP), review.id, "confirme")).ok).toBe(false)
    expect(t.landing_duplicate_reviews[0].status).toBe("signale")
    await flagDuplicate(actor("admin", ADM), { leadId: lead({ created_at: iso(120_000) }).id, primaryLeadId: t.landing_leads[0].id })
    expect((await decideDuplicate(actor("admin", ADM), t.landing_duplicate_reviews[1].id, "confirme")).ok).toBe(false) // même un Admin
    expect((await decideDuplicate(actor("manager", MGR2), review.id, "confirme", "même demande")).ok).toBe(true)
  })
  it("confirmation : le dossier sort de TOUS les chiffres (analyses, clients, ventes) mais reste consultable ; son STATUT et ses NOTES sont intacts ; aucune suppression", async () => {
    const { prim, cand, review } = await setup()
    get(cand.id).notes = "note commerciale à conserver"; get(cand.id).status = "reserve"; get(cand.id).booking_value = 500; get(prim.id).status = "reserve"; get(prim.id).booking_value = 500
    const before = (await loadAllCustomers())[0]
    expect(before.booked).toBe(2); expect(before.revenue).toBe(1000) // double comptage AVANT la décision
    const r = await decideDuplicate(actor("manager", MGR2), review.id, "confirme")
    expect(r.ok).toBe(true)
    expect(get(cand.id)).toMatchObject({ duplicate_of: prim.id, status: "reserve", notes: "note commerciale à conserver" })
    const after = (await loadAllCustomers())[0]
    expect(after.booked).toBe(1); expect(after.revenue).toBe(500) // une seule vente, un seul chiffre d'affaires
    expect((await selectRealLeads<Row>("select=id")).map((l) => l.id)).toEqual([prim.id]) // exclu du filtre central
    expect(t.landing_leads).toHaveLength(2) // rien n'est supprimé ni fusionné
    expect(writes("landing_leads")).toHaveLength(0) // le code n'écrit pas sur les dossiers : la base synchronise
    expect(t.landing_duplicate_reviews[0]).toMatchObject({ status: "confirme", decided_by: MGR2, purchase_state: "aucun" })
    expect(t.landing_lead_activities.map((a) => a.type)).toEqual(["duplicate_flagged", "duplicate_confirmed"])
  })
  it("rejet : le dossier reste compté (intérêt renouvelé ou réservation distincte)", async () => {
    const { cand, review } = await setup()
    expect((await decideDuplicate(actor("manager", MGR2), review.id, "rejete", "famille")).ok).toBe(true)
    expect(get(cand.id).duplicate_of).toBeNull(); expect((await selectRealLeads<Row>("select=id")).map((l) => l.id)).toContain(cand.id)
  })
  it("double décision refusée ; décision d'un signalement inconnu ou négatif refusée", async () => {
    const { review } = await setup()
    await decideDuplicate(actor("manager", MGR2), review.id, "rejete")
    expect(await decideDuplicate(actor("manager", MGR2), review.id, "confirme")).toMatchObject({ ok: false, error: expect.stringContaining("déjà été décidé") })
    for (const id of [9999, -1, 0, 1.5, Number.NaN]) expect((await decideDuplicate(actor("manager", MGR2), id, "confirme")).ok).toBe(false)
  })
  it("D2 : seul l'Admin rouvre ; la réouverture d'une confirmation remet le dossier dans les chiffres", async () => {
    const { cand, review } = await setup()
    await decideDuplicate(actor("manager", MGR2), review.id, "confirme")
    expect(get(cand.id).duplicate_of).not.toBeNull()
    expect((await reopenDuplicate(actor("manager", MGR2), review.id)).ok).toBe(false)
    expect((await reopenDuplicate(actor("employee", EMP), review.id)).ok).toBe(false)
    expect(get(cand.id).duplicate_of).not.toBeNull()
    expect((await reopenDuplicate(actor("admin", ADM), review.id, "erreur de saisie")).ok).toBe(true)
    expect(get(cand.id).duplicate_of).toBeNull(); expect(t.landing_duplicate_reviews[0]).toMatchObject({ status: "signale", decided_by: null })
    expect(t.landing_lead_activities.map((a) => a.type)).toEqual(["duplicate_flagged", "duplicate_confirmed", "duplicate_reopened"])
  })
  it("D6 : confirmation BLOQUÉE tant qu'une commission ou un coût est rattaché au doublon ; débloquée après réaffectation", async () => {
    const { prim, cand, review } = await setup()
    t.landing_commissions.push({ id: 1, lead_id: cand.id }); t.landing_variable_costs.push({ id: 2, lead_id: cand.id })
    const r = await decideDuplicate(actor("manager", MGR2), review.id, "confirme")
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/1 commission\(s\) et 1 coût\(s\)/) })
    expect(t.landing_duplicate_reviews[0].status).toBe("signale"); expect(get(cand.id).duplicate_of).toBeNull()
    t.landing_commissions[0].lead_id = prim.id; t.landing_variable_costs[0].lead_id = prim.id // réaffectés au principal
    expect((await decideDuplicate(actor("manager", MGR2), review.id, "confirme")).ok).toBe(true)
  })
  it("le rejet reste possible malgré des commissions rattachées (aucune règle financière ne change)", async () => {
    const { cand, review } = await setup()
    t.landing_commissions.push({ id: 1, lead_id: cand.id })
    expect((await decideDuplicate(actor("manager", MGR2), review.id, "rejete")).ok).toBe(true)
  })
})

describe("Purchase : retenu, envoyé, libéré (D3, D4, D7)", () => {
  it("D3 : doublon confirmé dont le Purchase est DÉJÀ ENVOYÉ : état « envoye » enregistré, avertissement, AUCUN envoi correctif à Meta", async () => {
    const prim = lead({ created_at: iso(0) }), cand = lead({ created_at: iso(60_000) })
    t.landing_conversion_log.push({ id: 1, lead_id: cand.id, network: "meta", event_name: "Purchase", event_id: `purchase-${cand.id}`, status: "sent", last_error: null })
    await flagDuplicate(actor("manager", MGR), { leadId: cand.id, primaryLeadId: prim.id })
    const r = await decideDuplicate(actor("manager", MGR2), t.landing_duplicate_reviews[0].id, "confirme")
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("aucune correction n'est envoyée à Meta") })
    expect(t.landing_duplicate_reviews[0].purchase_state).toBe("envoye")
    expect(metaPurchases()).toBe(0); expect(t.landing_conversion_log).toHaveLength(1) // rien envoyé, rien modifié
    expect(t.landing_conversion_log[0].status).toBe("sent")
  })
  it("Purchase RETENU : confirmé → jamais envoyé ; rejeté (réservation distincte) → LIBÉRÉ pour la relance habituelle", async () => {
    const prim = lead({ created_at: iso(0) }), cand = lead({ created_at: iso(60_000) })
    t.landing_conversion_log.push({ id: 1, lead_id: cand.id, network: "meta", event_name: "Purchase", event_id: `purchase-${cand.id}`, status: "skipped", last_error: "doublon:controle_doublon_indisponible", next_retry_at: null, attempts: 0 })
    await flagDuplicate(actor("manager", MGR), { leadId: cand.id, primaryLeadId: prim.id })
    await decideDuplicate(actor("manager", MGR2), t.landing_duplicate_reviews[0].id, "rejete")
    expect(t.landing_duplicate_reviews[0].purchase_state).toBe("retenu")
    expect(t.landing_conversion_log[0]).toMatchObject({ status: "failed", attempts: 0 }); expect(t.landing_conversion_log[0].next_retry_at).not.toBeNull() // repart par la relance
    // et à l'inverse, un retenu CONFIRMÉ doublon reste « skipped » pour toujours
    const prim2 = lead({ created_at: iso(0), phone: "21622000009" }), cand2 = lead({ created_at: iso(60_000), phone: "21622000009" })
    t.landing_conversion_log.push({ id: 2, lead_id: cand2.id, network: "meta", event_name: "Purchase", event_id: `purchase-${cand2.id}`, status: "skipped", last_error: "doublon:controle_doublon_indisponible" })
    await flagDuplicate(actor("manager", MGR), { leadId: cand2.id, primaryLeadId: prim2.id })
    await decideDuplicate(actor("manager", MGR2), t.landing_duplicate_reviews[1].id, "confirme")
    expect(t.landing_conversion_log[1].status).toBe("skipped"); expect(metaPurchases()).toBe(0)
  })
  it("la relance n'envoie JAMAIS la conversion d'un doublon confirmé", async () => {
    const prim = lead(), cand = lead({ duplicate_of: uuid(1), duplicate_confirmed_at: iso(0), tracking_consent: true })
    t.landing_conversion_log.push({ id: 1, lead_id: cand.id, network: "meta", event_name: "Purchase", event_id: `purchase-${cand.id}`, event_time: Math.floor(Date.now() / 1000), value_tnd: 500, status: "failed", attempts: 1, next_retry_at: null, created_at: new Date().toISOString() })
    expect(prim).toBeTruthy()
    const r = await retryConversions(Date.now() + 3600_000)
    expect(r).toMatchObject({ examined: 1, sent: 0, skipped: 1 }); expect(metaPurchases()).toBe(0)
    expect(t.landing_conversion_log[0]).toMatchObject({ status: "skipped", last_error: expect.stringContaining("doublon confirmé") })
  })
})

describe("FINANCIER — une réservation = une vente = un Purchase", () => {
  const actorStaff = { id: EMP, label: "employee@exemple.test" }
  const bookedPrimary = () => { const p = lead({ created_at: iso(0), status: "reserve", booked_at: iso(0), booking_value: 500 }); return p }

  it("un autre dossier du même client est déjà réservé pour la même offre : l'enregistrement S'ARRÊTE (rien d'écrit, aucun Purchase), avec la liste des dossiers", async () => {
    const prim = bookedPrimary(), second = lead({ created_at: iso(86_400_000) })
    const r = await changeStatus(second, "reserve", actorStaff, { bookingValue: 500 })
    expect(r).toMatchObject({ ok: false, code: "duplicate_reservation", conflicts: [{ id: prim.id, ref: prim.ref, status: "reserve", confidence: "elevee" }] })
    expect(writes("landing_leads")).toHaveLength(0); expect(writes("landing_conversion_log")).toHaveLength(0); expect(metaPurchases()).toBe(0)
    expect(get(second.id)).toMatchObject({ status: "contacte", booked_at: null })
  })
  it("« réservation DISTINCTE » avec motif : la réservation est enregistrée, UN Purchase part, la décision est tracée avec les dossiers concernés", async () => {
    const prim = bookedPrimary(), second = lead({ created_at: iso(86_400_000) })
    const r = await changeStatus(second, "reserve", actorStaff, { bookingValue: 700, distinctReservation: "deuxième départ pour la même famille" })
    expect(r).toMatchObject({ ok: true, conversion: "envoyée" })
    expect(get(second.id)).toMatchObject({ status: "reserve", booking_value: 700 }); expect(get(second.id).booked_at).not.toBeNull()
    expect(metaPurchases()).toBe(1); expect(t.landing_conversion_log.filter((l) => l.event_id === `purchase-${second.id}`)).toHaveLength(1)
    const note = t.landing_lead_activities.find((a) => a.type === "note")!
    expect(note.body).toContain(prim.ref); expect(note.body).toContain("deuxième départ pour la même famille")
  })
  it("pas de conflit (autre offre, autre produit, autre client, autre dossier non réservé, doublon déjà confirmé, test) : comportement actuel INCHANGÉ, un Purchase", async () => {
    bookedPrimary()
    lead({ offer: "Autre offre", status: "reserve" }); lead({ product: "hotel", status: "reserve" }); lead({ phone: "21622000002", status: "reserve" })
    lead({ status: "reserve", duplicate_of: uuid(1) }); lead({ status: "reserve", is_test: true })
    const fresh = lead({ offer: "Offre totalement différente", created_at: iso(86_400_000) })
    expect(await changeStatus(fresh, "reserve", actorStaff, { bookingValue: 400 })).toMatchObject({ ok: true, conversion: "envoyée" })
    expect(metaPurchases()).toBe(1)
  })
  it("réservé puis GAGNÉ = une seule vente : aucun nouveau contrôle, aucun second Purchase", async () => {
    const solo = lead({ created_at: iso(0) })
    expect((await changeStatus(solo, "reserve", actorStaff, { bookingValue: 500 })).ok).toBe(true)
    const reserved = { ...solo, ...get(solo.id) } as LeadRow
    expect(await changeStatus(reserved, "gagne", actorStaff)).toMatchObject({ ok: true, conversion: null })
    expect(metaPurchases()).toBe(1); expect(t.landing_conversion_log.filter((l) => l.event_name === "Purchase")).toHaveLength(1)
  })
  it("D4 : contrôle INDISPONIBLE (panne de lecture) → la réservation est enregistrée mais le Purchase est RETENU (journalisé, jamais envoyé), avec trace", async () => {
    const solo = lead({ created_at: iso(0) })
    leadsReadFails = true
    const r = await changeStatus(solo, "reserve", actorStaff, { bookingValue: 500 })
    expect(r).toMatchObject({ ok: true, conversion: "retenue" })
    expect(get(solo.id)).toMatchObject({ status: "reserve", booking_value: 500 }); expect(get(solo.id).booked_at).not.toBeNull()
    expect(metaPurchases()).toBe(0)
    expect(t.landing_conversion_log.filter((l) => l.event_name === "Purchase" || l.event_id === `purchase-${solo.id}`)).toEqual([expect.objectContaining({ event_id: `purchase-${solo.id}`, status: "skipped", last_error: expect.stringContaining("doublon:") })])
    expect(t.landing_lead_activities.some((a) => a.type === "note" && /Purchase retenu/.test(a.body))).toBe(true)
  })
  it("un Purchase retenu bloque aussi un second envoi (identifiant unique) : jamais deux Purchase pour un dossier", async () => {
    const solo = lead({ created_at: iso(0) })
    leadsReadFails = true; await changeStatus(solo, "reserve", actorStaff, { bookingValue: 500 }); leadsReadFails = false
    const again = lead({ created_at: iso(0), phone: "21622000077" })
    t.landing_conversion_log.push({ id: 50, lead_id: again.id, network: "meta", event_name: "Purchase", event_id: `purchase-${again.id}`, status: "sent" })
    await changeStatus(again, "reserve", actorStaff, { bookingValue: 500 }) // même identifiant déjà journalisé : pas de second envoi
    expect(metaPurchases()).toBe(0)
  })
  it("un dossier de TEST ne déclenche aucun contrôle ni aucun Purchase", async () => {
    bookedPrimary()
    const test = lead({ is_test: true, created_at: iso(86_400_000) })
    expect(await changeStatus(test, "reserve", actorStaff, { bookingValue: 400 })).toMatchObject({ ok: true, conversion: null }); expect(metaPurchases()).toBe(0)
  })
  it("un Purchase déjà journalisé sur un autre dossier (même statut « perdu » depuis) compte comme conflit", async () => {
    const old = lead({ created_at: iso(0), status: "perdu" })
    t.landing_conversion_log.push({ id: 1, lead_id: old.id, network: "meta", event_name: "Purchase", event_id: `purchase-${old.id}`, status: "sent" })
    const second = lead({ created_at: iso(86_400_000) })
    expect(await changeStatus(second, "reserve", actorStaff, { bookingValue: 400 })).toMatchObject({ ok: false, code: "duplicate_reservation" })
  })
})

describe("NOTES commerciales préservées", () => {
  it("le commentaire d'un changement de statut S'AJOUTE à la note du dossier (jamais d'écrasement) et reste dans l'historique", async () => {
    const l = lead({ notes: "Appel du 12/11 : veut 4 personnes", created_at: iso(0) })
    await changeStatus(l, "qualifie", { id: EMP, label: "e@exemple.test" }, { notes: "Budget confirmé" })
    expect(get(l.id).notes).toBe("Appel du 12/11 : veut 4 personnes\nBudget confirmé")
    expect(t.landing_lead_activities.find((a) => a.type === "status_change")!.body).toContain("Budget confirmé")
  })
  it("si l'ajout dépasse la limite du champ, la note du dossier n'est PAS modifiée (rien n'est perdu : l'historique garde le texte)", async () => {
    const long = "x".repeat(1900)
    const l = lead({ notes: long })
    await changeStatus(l, "qualifie", { id: EMP, label: "e@exemple.test" }, { notes: "y".repeat(300) })
    expect(get(l.id).notes).toBe(long); expect(t.landing_lead_activities.find((a) => a.type === "status_change")!.body).toContain("y".repeat(300))
  })
})
