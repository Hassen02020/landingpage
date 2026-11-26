import { afterEach, describe, expect, it, vi } from "vitest"
import { buildConversationBody, checkNote, CONVERSATION_THEMES, NOTE_MAX, themeLabel } from "@/lib/conversation-themes"
import { addNote, logCall, logWhatsApp, type LeadRow } from "@/lib/server/crm"
import { configureAll, installFetchMock } from "./helpers"

describe("thèmes de conversation (L2)", () => {
  it("expose exactement les 8 thèmes validés, dans l'ordre", () => {
    expect(CONVERSATION_THEMES.map((t) => t.label)).toEqual(["Prix demandé", "Dates", "Disponibilités", "Devis demandé", "Rappel demandé", "Hésitation", "Annulation", "Autre"])
    expect(themeLabel("prix")).toBe("Prix demandé")
    expect(themeLabel("inconnu")).toBeNull()
  })

  it("thème valide accepté ; thème absent ou inconnu refusé", () => {
    expect(buildConversationBody("dates", "")).toEqual({ ok: true, body: "[Dates]" })
    expect(buildConversationBody("dates", "fin août")).toEqual({ ok: true, body: "[Dates] fin août" })
    expect(buildConversationBody("", "x")).toMatchObject({ ok: false })
    expect(buildConversationBody("nimporte", "x")).toMatchObject({ ok: false })
  })

  it("« Autre » : note obligatoire", () => {
    expect(buildConversationBody("autre", "")).toMatchObject({ ok: false })
    expect(buildConversationBody("autre", "   ")).toMatchObject({ ok: false })
    expect(buildConversationBody("autre", "demande un visa")).toEqual({ ok: true, body: "[Autre] demande un visa" })
  })

  it("note : 140 caractères acceptés, 141 refusés", () => {
    expect(checkNote("a".repeat(NOTE_MAX), false).ok).toBe(true)
    expect(checkNote("a".repeat(NOTE_MAX + 1), false)).toMatchObject({ ok: false })
  })

  it("note : numéro de téléphone, e-mail et lien refusés (formats courants)", () => {
    for (const bad of ["appelez le 98 140 514", "mon numéro +216 98.140.514", "0033612345678", "a.b@exemple.com", "écrire à moi@x.tn", "voir https://exemple.com/x", "www.site.tn", "regardez site.com", "wa.me/21698140514"]) {
      expect(checkNote(bad, false), bad).toMatchObject({ ok: false })
    }
  })

  it("note : textes métier ordinaires acceptés (pas de faux positif)", () => {
    for (const ok of ["4 personnes, fin août", "veut le prix pour 2 adultes et 1 enfant", "rappeler demain à 10h", "budget autour de 5000 dinars", "Omra 2027, chambre double"]) {
      expect(checkNote(ok, false), ok).toMatchObject({ ok: true })
    }
  })
})

const actor = { id: "11111111-1111-4111-8111-111111111111", label: "agent@easy2book.tn" }
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
const lead = { id: "L1", anonymized_at: null } as LeadRow

describe("enregistrement serveur (L2)", () => {
  it("WhatsApp : sans thème, rien n'est écrit ; avec thème, seul « [Thème] note » est conservé", async () => {
    configureAll()
    const f = installFetchMock()
    expect(await logWhatsApp(lead, "in", { theme: "", note: "x" }, actor)).toMatchObject({ ok: false })
    expect(await logWhatsApp(lead, "in", { theme: "prix", note: "a".repeat(141) }, actor)).toMatchObject({ ok: false })
    expect(await logWhatsApp(lead, "in", { theme: "prix", note: "écrire à moi@x.tn" }, actor)).toMatchObject({ ok: false })
    expect(f.db.landing_lead_activities ?? []).toHaveLength(0)
    expect(await logWhatsApp(lead, "in", { theme: "hesitation", note: "compare avec un autre" }, actor)).toEqual({ ok: true })
    expect(f.db.landing_lead_activities[0]).toMatchObject({ type: "wa_in", body: "[Hésitation] compare avec un autre" })
  })

  it("appel : enregistré comme note « [Appel · Thème] », même contrôle", async () => {
    configureAll()
    const f = installFetchMock()
    expect(await logCall(lead, { theme: "autre", note: "" }, actor)).toMatchObject({ ok: false })
    expect(await logCall(lead, { theme: "rappel", note: "demain matin" }, actor)).toEqual({ ok: true })
    expect(f.db.landing_lead_activities[0]).toMatchObject({ type: "note", body: "[Appel · Rappel demandé] demain matin" })
  })

  it("note de l'historique : limitée à 140, sans numéro, e-mail ni lien", async () => {
    configureAll()
    const f = installFetchMock()
    expect(await addNote(lead, "a".repeat(141), actor)).toMatchObject({ ok: false })
    expect(await addNote(lead, "appeler 98140514", actor)).toMatchObject({ ok: false })
    expect(await addNote(lead, "", actor)).toMatchObject({ ok: false })
    expect(await addNote(lead, "rappelé, intéressé", actor)).toEqual({ ok: true })
    expect(f.db.landing_lead_activities).toHaveLength(1)
  })

  it("lead anonymisé : tout est refusé, rien n'est écrit", async () => {
    configureAll()
    const f = installFetchMock()
    const locked = { id: "L2", anonymized_at: "2026-01-01" } as LeadRow
    expect((await logWhatsApp(locked, "in", { theme: "prix" }, actor)).ok).toBe(false)
    expect((await logCall(locked, { theme: "prix" }, actor)).ok).toBe(false)
    expect(f.dbCalls().filter((c) => c.method !== "GET")).toHaveLength(0)
  })
})

describe("vert WhatsApp du CRM (L2)", () => {
  // contraste WCAG calculé (pas mesuré à l'écran) : --e2b-wa (#0e7a3c) avec du texte blanc
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  it("blanc sur --e2b-wa et sur --e2b-wa-dark : contraste ≥ 4,5 (AA)", () => {
    expect(ratio("#0e7a3c", "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(ratio("#0b6a33", "#ffffff")).toBeGreaterThanOrEqual(4.5)
  })
})
