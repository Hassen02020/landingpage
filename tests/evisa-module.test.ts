// Module E-Visa (page « sur devis ») : liste de destinations, aucun prix, destination enregistrée dans le lead. Jeux de données FICTIFS.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { resetProtectionCache } from "@/lib/server/protection"
import { defaultDesign, MAX_DESTINATIONS, sanitizeDesign } from "@/lib/page-builder/design"
import { EVISA_DESTINATIONS, THEMES } from "@/lib/page-builder/themes"
import { readiness } from "@/lib/page-builder/readiness"
import { faqFor } from "@/lib/page-builder/faq"
import type { Category } from "@/lib/server/catalog"
import { configureAll, installFetchMock, post } from "./helpers"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => undefined }) }))
let LandingView: typeof import("@/app/p/[slug]/LandingView").LandingView
beforeAll(async () => {
  ;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs
  LandingView = (await import("@/app/p/[slug]/LandingView")).LandingView
})
beforeEach(() => resetProtectionCache())
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const ROOT = new URL("..", import.meta.url).pathname
const theme = THEMES.find((t) => t.id === "evisa")!
const designOf = () => sanitizeDesign(theme.preset!.design, "autre")
const category = (): Category => ({ id: "c-evisa", slug: "evisa", name: theme.preset!.name, product: "autre", lang: "ar", headline: theme.preset!.headline, description: theme.preset!.description, banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, created_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z" } as unknown as Category)
const html = () => renderToStaticMarkup(createElement(LandingView, { category: category(), offers: [], design: designOf().design }))

describe("E-Visa : modèle et liste de destinations", () => {
  it("le modèle existe : produit « autre », arabe, aucune offre préremplie, adresse « evisa »", () => {
    expect(theme).toMatchObject({ product: "autre", family: "autre", lang: "ar" })
    expect(theme.preset!.offers).toEqual([])
    expect(theme.preset!.slug).toBe("evisa")
  })
  it("sa personnalisation est valide (aucune erreur) et garde toutes les destinations", () => {
    const r = designOf()
    expect(r.errors).toEqual({})
    expect(r.design.form.destinations).toEqual(EVISA_DESTINATIONS)
    expect(r.design.form.destinations.length).toBe(33)
  })
  it("même en-tête et pied de page que l'Omra Ramadan (mise en page « split ») avec la vidéo finale du site", () => {
    const d = designOf().design
    expect(d.hero).toBe("split")
    expect(d.blocks.find((b) => b.type === "video")).toMatchObject({ video: "/evisa-passeport-tunisien.mp4", images: ["/evisa-passeport-tunisien-poster.jpg"] })
    const h = html()
    expect(h).toContain("/evisa-passeport-tunisien.mp4")
    expect(h).toContain('href="#video"')
    expect(readFileSync(ROOT + "public/evisa-passeport-tunisien.mp4").length).toBeGreaterThan(1_000_000)
    expect(readFileSync(ROOT + "public/evisa-passeport-tunisien-poster.jpg").length).toBeGreaterThan(10_000)
  })
  it("la dernière destination est « Autre destination (selon demande) » ; aucune destination signalée « non vérifiée » n'est proposée", () => {
    expect(EVISA_DESTINATIONS[EVISA_DESTINATIONS.length - 1]).toMatch(/Autre destination/)
    for (const n of ["Botswana", "Burkina", "Cameroun", "Congo", "Djibouti", "Gabon", "Nigeria", "Sao Tom", "Sierra", "Soudan", "Trinité"]) expect(EVISA_DESTINATIONS.join("|")).not.toContain(n)
  })
  it("aucun prix, délai ni nombre de pays « sans visa » dans les textes du modèle", () => {
    const all = JSON.stringify(theme.preset)
    expect(all).not.toMatch(/TND|د\.ت|دينار|\b\d+\s*(jours|days)|أيام|42 |بدون فيزا/)
  })
  it("nettoyage : doublons, espaces, vides et valeurs non textuelles retirés ; longueur et nombre bornés", () => {
    const d = sanitizeDesign({ form: { destinations: ["  Albanie ", "Albanie", "", 42, null, "x".repeat(200), "Thaïlande"] } }, "autre").design.form.destinations
    expect(d).toEqual(["Albanie", "x".repeat(64), "Thaïlande"])
    const many = sanitizeDesign({ form: { destinations: Array.from({ length: MAX_DESTINATIONS + 5 }, (_, i) => `Pays ${i}`) } }, "autre")
    expect(many.design.form.destinations).toHaveLength(MAX_DESTINATIONS)
    expect(many.errors.destinations).toMatch(/maximum/)
  })
  it("par défaut (toutes les pages existantes) : aucune liste", () => {
    for (const f of ["omra", "voyage", "hotel", "autre"] as const) expect(defaultDesign(f).form.destinations).toEqual([])
    expect(sanitizeDesign({}, "omra").design.form.destinations).toEqual([])
  })
})

describe("E-Visa : vérification avant publication", () => {
  const cat = { name: "E-Visa", slug: "evisa", product: "autre", headline: "Accroche", description: "Une présentation de plus de vingt caractères.", banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: false }
  it("sans offre mais avec une liste de destinations : aucune exigence d'offre (page sur devis)", () => {
    const r = readiness(cat, [], "2026-11-20", "evisa", { destinations: 33 })
    expect(r.checks.find((c) => c.id === "offre")).toMatchObject({ ok: true, label: "Page sur devis" })
    expect(r.blocking).toBe(0)
  })
  it("sans offre ni liste : toujours bloqué comme avant", () => {
    expect(readiness(cat, [], "2026-11-20", "evisa", { destinations: 0 }).checks.find((c) => c.id === "offre")?.ok).toBe(false)
    expect(readiness(cat, [], "2026-11-20", "autre").checks.find((c) => c.id === "offre")?.ok).toBe(false)
  })
})

describe("E-Visa : page publique", () => {
  it("affiche la liste de destinations obligatoire, aucun prix, aucun lien vers des offres", () => {
    const h = html()
    expect(h).toMatch(/<select[^>]*name="destination"[^>]*required/)
    expect((h.match(/<option value="[^"]+"/g) ?? []).filter((o) => o.includes("·")).length).toBe(33)
    expect(h).toContain("اطلب عرض سعر")
    expect(h).not.toMatch(/TND|د\.ت/)
    expect(h).not.toContain('href="#offres"')
    expect(h).toContain("ملاحظة رسمية")
  })
  it("les autres pages n'ont ni liste de destinations ni champ obligatoire", () => {
    const d = sanitizeDesign({}, "autre").design
    const h = renderToStaticMarkup(createElement(LandingView, { category: category(), offers: [], design: d }))
    expect(h).not.toContain('name="destination"')
  })
  it("la FAQ d'une page sur devis ne parle ni de prix ni de places, et rappelle que l'acceptation relève des autorités", () => {
    const f = JSON.stringify(faqFor("autre", "ar", true)) + JSON.stringify(faqFor("autre", "fr", true))
    expect(f).not.toMatch(/prix|الأسعار|places|مقاعد/i)
    expect(f).toMatch(/autorités|سلطات/)
    expect(faqFor("autre", "fr")).toHaveLength(3) // comportement historique inchangé
  })
})

describe("E-Visa : le lead conserve la destination choisie", () => {
  let n = 0
  const mk = (o: Record<string, unknown> = {}) => ({ name: "Ahmed Ben Ali", phone: `9816${String(1000 + ++n).slice(-4)}`, product: "autre", contactConsent: true, niche: "evisa", ...o })
  it("la destination choisie est enregistrée dans le lead du site (comportement existant, vérifié pour l'E-Visa)", async () => {
    configureAll(); const f = installFetchMock()
    const res = await leadsPOST(post("/api/leads", mk({ destination: "ألبانيا · Albanie" })))
    expect((await res.json()).ok).toBe(true)
    expect(f.db.landing_leads[0]).toMatchObject({ destination: "ألبانيا · Albanie", niche: "evisa", product: "autre" })
  })
  it("sans destination : rien n'est enregistré (comportement historique)", async () => {
    configureAll(); const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk()))
    expect(f.db.landing_leads[0].destination ?? null).toBeNull()
  })
  it("la destination est bornée à 128 caractères", async () => {
    configureAll(); const f = installFetchMock()
    await leadsPOST(post("/api/leads", mk({ destination: "x".repeat(500) })))
    expect(String(f.db.landing_leads[0].destination).length).toBeLessThanOrEqual(128)
  })
})
