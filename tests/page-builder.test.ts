import { describe, expect, it } from "vitest"
import { THEMES, familyOf, themeById } from "../lib/page-builder/themes"
import { faqFor } from "../lib/page-builder/faq"
import { readiness, type CategoryLike, type OfferRow } from "../lib/page-builder/readiness"
import { isOfferExpired, isOfferValid, pageStatus } from "../lib/page-status"
import { RESERVED_SLUGS, slugLock } from "../lib/catalog-slug"

const TODAY = "2026-11-13"
const cat = (o: Partial<CategoryLike> = {}): CategoryLike => ({ name: "Omra Ramadan 2027", slug: "omra-ramadan-2027", product: "omra", lang: "ar", headline: "Une accroche", description: "Une présentation assez longue du produit.", banner_desktop: "https://x.test/a.jpg", banner_mobile: null, seo_title: "t", seo_description: "d", visible: false, ...o })
const offer = (o: Partial<OfferRow> = {}): OfferRow => ({ id: "o1", name: "Départ 1", price: 5500, departure_date: "2027-02-10", nights: 14, destination: null, features: ["Vol"], description: "Programme", image_url: "https://x.test/o.jpg", seats_total: 40, seats_sold: 3, visible: true, archived_at: null, ...o })

describe("thèmes", () => {
  it("dix thèmes aux identifiants uniques, chacun avec produit, famille et langue valides", () => {
    expect(THEMES).toHaveLength(10)
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10)
    for (const t of THEMES) {
      expect(["omra", "voyage", "hotel", "autre"]).toContain(t.product)
      expect(familyOf(t.product)).toBe(t.family)
      expect(["fr", "ar"]).toContain(t.lang)
      expect(t.offerFields).toContain("name"); expect(t.offerFields).toContain("price")
    }
    for (const id of ["omra", "ramadan-omra", "voyage-organise", "turquie", "hotel", "sejour", "promotion", "circuit", "vacances", "autre"]) expect(themeById(id)?.id).toBe(id)
    expect(themeById("inconnu")).toBeNull()
  })
  it("aucun prix, date, disponibilité ni avis n'est pré-rempli : les aides de saisie sont des « ex. » ou des consignes", () => {
    for (const t of THEMES) for (const [k, v] of Object.entries(t.hints)) if (v && k !== "destination") expect(/\d+\s?(TND|DT|dinars?)|\bTND\b|avis|★|%/i.test(v), `${t.id}.${k}: ${v}`).toBe(false)
  })
  it("les familles couvrent le produit : omra→omra, voyage→voyage, hotel→hotel, autre→autre", () => {
    expect([familyOf("omra"), familyOf("voyage"), familyOf("hotel"), familyOf("autre"), familyOf("x"), familyOf(null)]).toEqual(["omra", "voyage", "hotel", "autre", "autre", "autre"])
  })
})

describe("FAQ générique : seulement le processus, jamais de fait inventé", () => {
  it("fr et ar pour chaque famille ; au moins 3 questions ; aucun chiffre", () => {
    for (const f of ["omra", "voyage", "hotel", "autre"] as const) for (const l of ["fr", "ar"] as const) {
      const faq = faqFor(f, l)
      expect(faq.length).toBeGreaterThanOrEqual(3)
      for (const x of faq) { expect(x.q.length).toBeGreaterThan(5); expect(/\d/.test(x.a.replace(/Easy2Book/g, "")), x.a).toBe(false) }
    }
    expect(faqFor("autre", "fr")).toHaveLength(3)
    expect(faqFor("omra", "fr")).toHaveLength(4)
  })
})

describe("état d'une page (disponibilité)", () => {
  it("masquée, sans offre, offres expirées, prête ; une offre sans date n'expire jamais ; le jour du départ elle reste valide", () => {
    expect(pageStatus({ visible: false, offers: [offer()], today: TODAY }).state).toBe("masquee")
    expect(pageStatus({ visible: true, offers: [], today: TODAY }).state).toBe("sans_offre")
    expect(pageStatus({ visible: true, offers: [offer({ visible: false }), offer({ archived_at: "2026-01-01" })], today: TODAY }).state).toBe("sans_offre")
    expect(pageStatus({ visible: true, offers: [offer({ departure_date: "2026-11-12" })], today: TODAY }).state).toBe("offres_expirees")
    expect(pageStatus({ visible: true, offers: [offer({ departure_date: TODAY })], today: TODAY }).state).toBe("prete")
    expect(pageStatus({ visible: true, offers: [offer({ departure_date: null })], today: TODAY }).state).toBe("prete")
    const s = pageStatus({ visible: true, offers: [offer(), offer({ departure_date: "2026-01-01" })], today: TODAY })
    expect([s.state, s.validOffers, s.expiredOffers]).toEqual(["prete", 1, 1])
    expect(isOfferExpired("2026-11-12", TODAY)).toBe(true); expect(isOfferExpired(TODAY, TODAY)).toBe(false); expect(isOfferExpired(null, TODAY)).toBe(false)
    expect(isOfferValid(offer({ visible: false }), TODAY)).toBe(false)
  })
  it("offre complète : encore valide, signalée ; page « prête » ok=true seulement si une offre est valide", () => {
    const s = pageStatus({ visible: true, offers: [offer({ seats_total: 5, seats_sold: 5 })], today: TODAY })
    expect([s.state, s.soldOutOffers, s.tone]).toEqual(["prete", 1, "warn"])
    expect(pageStatus({ visible: true, offers: [offer()], today: TODAY }).ok).toBe(true)
    expect(pageStatus({ visible: false, offers: [offer()], today: TODAY }).ok).toBe(false)
  })
})

describe("complétude avant publication", () => {
  it("page complète : prête, sans blocage", () => {
    const r = readiness(cat(), [offer()], TODAY, "ramadan-omra")
    expect(r.ready).toBe(true); expect(r.blocking).toBe(0)
  })
  it("sans accroche, sans présentation, sans offre : blocages explicites", () => {
    const r = readiness(cat({ headline: null, description: "court" }), [], TODAY)
    expect(r.ready).toBe(false)
    const ko = r.checks.filter((c) => !c.ok && c.level === "bloquant").map((c) => c.id)
    expect(ko).toEqual(expect.arrayContaining(["accroche", "presentation", "offre"]))
  })
  it("Omra : la date et les nuits sont obligatoires MÊME si le navigateur envoie un autre thème (exigence minimale de la famille)", () => {
    const r = readiness(cat(), [offer({ departure_date: null, nights: null })], TODAY, "autre")
    expect(r.ready).toBe(false)
    expect(r.checks.find((c) => c.id.startsWith("offre:"))?.detail).toMatch(/departure_date/)
  })
  it("le prix est toujours obligatoire ; un prix vide n'est pas 0", () => {
    expect(readiness(cat(), [offer({ price: null })], TODAY).ready).toBe(false)
    expect(readiness(cat(), [offer({ price: "" })], TODAY).ready).toBe(false)
    expect(readiness(cat(), [offer({ price: 0 })], TODAY).ready).toBe(true)
  })
  it("toutes les offres expirées : bloqué ; une offre expirée parmi d'autres : avertissement", () => {
    expect(readiness(cat(), [offer({ departure_date: "2026-01-01" })], TODAY).ready).toBe(false)
    const r = readiness(cat(), [offer(), offer({ id: "o2", departure_date: "2026-01-01" })], TODAY)
    expect(r.ready).toBe(true)
    expect(r.checks.find((c) => c.id === "expirees")?.level).toBe("avertissement")
  })
  it("promotion : le prix barré doit être supérieur au prix", () => {
    const c = cat({ product: "autre" })
    expect(readiness(c, [offer({ price: 100, price_before: 80, departure_date: null, nights: null })], TODAY, "promotion").ready).toBe(false)
    expect(readiness(c, [offer({ price: 100, price_before: 150, departure_date: null, nights: null })], TODAY, "promotion").ready).toBe(true)
  })
  it("avertissements (non bloquants) : bannière, prestations, programme, photos, places, SEO", () => {
    const r = readiness(cat({ banner_desktop: null, seo_title: null }), [offer({ features: [], description: null, image_url: null, seats_total: null })], TODAY)
    expect(r.ready).toBe(true)
    expect(r.warnings).toBeGreaterThanOrEqual(5)
  })
  it("une offre masquée ou archivée n'est pas vérifiée (elle n'apparaît pas publiquement)", () => {
    const r = readiness(cat(), [offer(), offer({ id: "o2", price: null, visible: false })], TODAY)
    expect(r.ready).toBe(true)
  })
})

describe("protection de l'adresse", () => {
  it("brouillon jamais utilisé : modifiable", () => expect(slugLock({ slug: "x", visible: false, referenced: false }).locked).toBe(false))
  it("publiée, déjà utilisée, réservée, vérification impossible : verrouillée avec un message", () => {
    for (const [input, reason] of [
      [{ slug: "x", visible: true, referenced: false }, "visible"],
      [{ slug: "x", visible: false, referenced: true }, "utilisee"],
      [{ slug: "omra-2027", visible: false, referenced: false }, "reserved"],
      [{ slug: "x", visible: false, referenced: "inconnu" as const }, "verification"],
    ] as const) {
      const l = slugLock(input)
      expect(l.locked && l.reason).toBe(reason)
      expect(l.locked && l.message.length).toBeGreaterThan(20)
    }
    expect(RESERVED_SLUGS).toContain("omra-2027")
  })
})
