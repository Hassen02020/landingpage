// Sécurisation avant l'augmentation du budget publicitaire : noms, doublons avec historique, limites de débit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/leads/route"
import { __resetGuards } from "@/lib/server/guard"
import { stripHiddenChars } from "@/lib/server/attribution"
import { configureAll, installFetchMock, post } from "./helpers"

const base = { eventId: "hard-evt-0001", name: "Ahmed Ben Ali", phone: "98 140 514", product: "omra", offer: "Omra Ramadan complet", adults: 2, children: 1, contactConsent: true, marketingConsent: false, trackingConsent: false }

beforeEach(() => { __resetGuards(); configureAll() })
afterEach(() => vi.unstubAllEnvs())

describe("noms et textes libres : caractères cachés retirés, tout le reste conservé", () => {
  it("stripHiddenChars retire le caractère nul, l'inversion de sens et le zéro-largeur, garde arabe, emoji, accents et retours à la ligne", () => {
    expect(stripHiddenChars("A\u0000B‮evil​zero﻿!")).toBe("ABevilzero!")
    expect(stripHiddenChars("محمد علي 🌙 Çelik\nligne 2\tok")).toBe("محمد علي 🌙 Çelik\nligne 2\tok")
  })

  it("le lead est enregistré avec un nom nettoyé (le caractère nul ferait échouer PostgreSQL)", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/leads", { ...base, name: "Sa\u0000ra‮ Ben​ Ali" }))
    expect(res.status).toBe(200)
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.db.landing_leads[0]).toMatchObject({ first_name: "Sara", last_name: "Ben Ali" })
    expect(JSON.stringify(f.db.landing_leads[0])).not.toMatch(/\\u0000|‮|​/)
  })

  it("noms arabes, emoji, très longs et balises : valeurs exactes conservées, longueurs bornées à 100", async () => {
    const f = installFetchMock()
    const names: [string, { first: string; last?: string | null }][] = [
      ["محمد علي بن سالم", { first: "محمد", last: "علي بن سالم" }],
      ["Sarah 🌙✈️ Ben Ali", { first: "Sarah", last: "🌙✈️ Ben Ali" }],
      ["A".repeat(10000), { first: "A".repeat(100), last: null }],
      ["<script>x</script> <b>y</b>", { first: "<script>x</script>", last: "<b>y</b>" }],
    ]
    for (const [i, [name, exp]] of Array.from(names.entries())) {
      await POST(post("/api/leads", { ...base, eventId: `hard-evt-n${i}0000`, phone: `2${String(3000000 + i)}`, name }, { "x-forwarded-for": `7.7.7.${i}` }))
      const row = f.db.landing_leads[i]
      expect(row.first_name).toBe(exp.first)
      expect(row.last_name ?? null).toBe(exp.last ?? null)
    }
  })
})

describe("doublon : la nouvelle demande est consignée dans l'historique du lead existant", () => {
  it("même numéro, même produit, autre offre (mémoire) : 1 seul lead, 1 note d'historique avec l'offre, les voyageurs et l'annonce", async () => {
    const f = installFetchMock()
    const first = await (await POST(post("/api/leads", base))).json()
    const second = await (await POST(post("/api/leads", { ...base, eventId: "hard-evt-0002", offer: "Omra Chawwal", adults: 3, children: 0, attribution: { last_touch: { channel: "meta", utm_campaign: "omra-ramadan-2027-fb", utm_content: "video-omra-ramadan", landing_page: "/p/omra-chawwal" } } }))).json()
    expect(second).toMatchObject({ ok: true, duplicate: true, ref: first.ref })
    expect(f.db.landing_leads).toHaveLength(1)
    const notes = f.db.landing_lead_activities.filter((a) => a.type === "note")
    expect(notes).toHaveLength(1)
    expect(notes[0].body).toMatch(/Omra Chawwal/)
    expect(notes[0].body).toMatch(/3 adulte/)
    expect(notes[0].body).toMatch(/omra-ramadan-2027-fb/)
    expect(notes[0].body).toMatch(/video-omra-ramadan/)
    expect(notes[0].lead_id).toBe(f.db.landing_leads[0].id)
  })

  it("même numéro, même produit, autre instance serveur (base) : même résultat", async () => {
    const f = installFetchMock()
    const first = await (await POST(post("/api/leads", base))).json()
    __resetGuards()
    const second = await (await POST(post("/api/leads", { ...base, eventId: "hard-evt-0003", offer: "Omra FOJ 1" }))).json()
    expect(second).toMatchObject({ duplicate: true, ref: first.ref })
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.db.landing_lead_activities.filter((a) => a.type === "note" && /Omra FOJ 1/.test(a.body))).toHaveLength(1)
  })

  it("le même envoi rejoué (double clic) ne crée AUCUNE note", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", base))
    await POST(post("/api/leads", base))
    __resetGuards()
    await POST(post("/api/leads", base))
    expect(f.db.landing_leads).toHaveLength(1)
    expect(f.db.landing_lead_activities.filter((a) => a.type === "note")).toHaveLength(0)
  })

  it("aucun second évènement Lead n'est envoyé à Meta pour une nouvelle demande doublon", async () => {
    const f = installFetchMock()
    await POST(post("/api/leads", { ...base, trackingConsent: true }))
    await POST(post("/api/leads", { ...base, eventId: "hard-evt-0004", offer: "Autre", trackingConsent: true }))
    expect(f.meta()).toHaveLength(1)
  })
})

describe("limites de débit : IP large + limite par numéro de téléphone", () => {
  it("un même numéro est limité à 3 NOUVELLES demandes par 10 minutes (autres produits), les doublons ne comptent pas", async () => {
    installFetchMock()
    const statuses: number[] = []
    for (const [i, product] of Array.from(["omra", "voyage", "hotel", "autre"].entries())) {
      statuses.push((await POST(post("/api/leads", { ...base, eventId: `hard-evt-p${i}0000`, product }, { "x-forwarded-for": `6.6.6.${i}` }))).status)
    }
    expect(statuses).toEqual([200, 200, 200, 429])
    // les doublons (même produit) du numéro déjà accepté ne sont pas comptés comme de nouvelles demandes
    for (let i = 0; i < 5; i++) expect((await POST(post("/api/leads", { ...base, eventId: `hard-evt-d${i}0000`, product: "omra" }, { "x-forwarded-for": `5.5.5.${i}` }))).status).toBe(200)
  })

  it("des clients différents derrière la même adresse IP mobile ne se bloquent pas entre eux (jusqu'à 20 par 10 min)", async () => {
    const f = installFetchMock()
    for (let i = 0; i < 15; i++) {
      const res = await POST(post("/api/leads", { ...base, eventId: `hard-evt-c${String(i).padStart(2, "0")}000`, phone: `2${String(4000000 + i)}`, name: `Client ${i}` }, { "x-forwarded-for": "41.226.0.1" }))
      expect(res.status).toBe(200)
    }
    expect(f.db.landing_leads).toHaveLength(15)
  })

  it("la protection anti-abus reste active : champ piège, origine étrangère, IP au-delà de 20", async () => {
    const f = installFetchMock()
    expect((await POST(post("/api/leads", { ...base, website: "http://spam" }))).status).toBe(200)
    expect(f.db.landing_leads).toHaveLength(0)
    expect((await POST(post("/api/leads", base, { origin: "https://evil.example" }))).status).toBe(403)
    const codes: number[] = []
    for (let i = 0; i < 22; i++) codes.push((await POST(post("/api/leads", { ...base, eventId: `hard-evt-r${String(i).padStart(2, "0")}000`, phone: `2${String(5000000 + i)}` }, { "x-forwarded-for": "8.8.8.8" }))).status)
    expect(codes.filter((c) => c === 429).length).toBe(2)
  })
})
