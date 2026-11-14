import { describe, expect, it } from "vitest"
import { THEMES } from "@/lib/page-builder/themes"
import { MAX_DESIGN_BYTES, designBytes, contrastWithWhite, defaultDesign, resolvePrimary, sanitizeDesign, tint, visibleSections } from "@/lib/page-builder/design"

describe("personnalisation : validation stricte", () => {
  it("sans données : design par défaut de la famille (aucune couleur imposée, form visible)", () => {
    const { design, errors } = sanitizeDesign(undefined, "voyage")
    expect(errors).toEqual({})
    expect(resolvePrimary(design)).toBeNull()
    expect(design.sections.map((s) => s.key)).toEqual(["intro", "highlights", "offers", "programme", "gallery", "inclusions", "testimonials", "faq", "form"])
    expect(visibleSections(design)).not.toContain("testimonials") // aucun témoignage fourni : aucune section
  })
  it("couleur personnalisée : hexadécimal obligatoire ; trop claire refusée (texte blanc illisible) ; valeur sûre acceptée", () => {
    expect(sanitizeDesign({ colors: { custom: "rouge" } }, "omra").errors.custom).toMatch(/hexad/)
    expect(sanitizeDesign({ colors: { custom: "#ffee00" } }, "omra").errors.custom).toMatch(/trop claire/)
    expect(sanitizeDesign({ colors: { custom: "red;background:url(x)" } }, "omra").errors.custom).toBeTruthy()
    const ok = sanitizeDesign({ colors: { custom: "#1D4ED8" } }, "omra")
    expect(ok.errors).toEqual({})
    expect(resolvePrimary(ok.design)).toBe("#1d4ed8")
    expect(contrastWithWhite("#1d4ed8")).toBeGreaterThan(4.5)
    expect(contrastWithWhite("#ffffff")).toBeLessThan(1.5)
  })
  it("préréglage connu accepté, inconnu signalé et écarté", () => {
    expect(resolvePrimary(sanitizeDesign({ colors: { preset: "bleu" } }, "hotel").design)).toBe("#1d4ed8")
    const bad = sanitizeDesign({ colors: { preset: "arc-en-ciel" } }, "hotel")
    expect(bad.errors.colors).toBeTruthy()
    expect(resolvePrimary(bad.design)).toBeNull()
  })
  it("ordre des sections : permutation, sections inconnues ignorées, manquantes ajoutées, « form » jamais masqué", () => {
    const { design } = sanitizeDesign({ sections: [{ key: "faq", visible: true }, { key: "pirate", visible: true }, { key: "form", visible: false }, { key: "offers", visible: false }, { key: "faq", visible: false }] }, "autre")
    expect(design.sections.map((s) => s.key)).toEqual(["faq", "form", "offers", "intro", "inclusions", "testimonials"])
    expect(design.sections.find((s) => s.key === "form")!.visible).toBe(true)
    expect(design.sections.find((s) => s.key === "offers")!.visible).toBe(false)
    expect(visibleSections(design)).toEqual(["faq", "form", "intro", "inclusions"])
    // une section d'une autre famille (galerie sur « autre ») est refusée
    expect(sanitizeDesign({ sections: [{ key: "gallery", visible: true }] }, "autre").design.sections.some((s) => s.key === "gallery")).toBe(false)
  })
  it("FAQ, témoignages, programme : bornés, incomplets signalés ET écartés, texte brut nettoyé", () => {
    const r = sanitizeDesign({
      faq: [{ q: "Question ?", a: "Réponse" }, { q: "Sans réponse", a: "" }],
      testimonials: [{ name: "Amel", text: "Très bien organisé", place: "Tunis" }, { name: "", text: "anonyme" }],
      program: [{ title: "Jour 1", text: "Arrivée" }],
    }, "voyage")
    expect(r.design.faq).toEqual([{ q: "Question ?", a: "Réponse" }])
    expect(r.design.testimonials).toEqual([{ name: "Amel", text: "Très bien organisé", place: "Tunis" }])
    expect(r.errors.faq1).toBeTruthy(); expect(r.errors.testimonial1).toBeTruthy()
    expect(visibleSections(r.design)).toContain("testimonials")
    const many = sanitizeDesign({ faq: Array.from({ length: 12 }, (_, i) => ({ q: `q${i}`, a: "a" })) }, "voyage")
    expect(many.design.faq).toHaveLength(8); expect(many.errors.faq).toMatch(/maximum/)
    expect(sanitizeDesign({ cta: { label: "A\u0000B".padEnd(100, "x") } }, "voyage").design.cta.label).toHaveLength(40)
  })
  it("présentation des prix et bouton : valeurs par défaut sûres ; entrée de type incorrect ignorée", () => {
    expect(defaultDesign("hotel").price).toEqual({ prefix: true, showBefore: true })
    const d = sanitizeDesign({ price: { prefix: false }, cta: { label: 12, whatsapp: "oui" }, background: "<b>" }, "hotel").design
    expect(d.price).toEqual({ prefix: false, showBefore: true })
    expect(d.cta).toEqual({ label: "", whatsapp: false })
    expect(d.background).toBe("famille")
  })
  it("teinte : mélange avec du blanc", () => { expect(tint("#000000", 0.9)).toBe("#e6e6e6") })
})

describe("taille : jamais plus que ce que la base accepte (CHECK 16 000 octets)", () => {
  const big = { faq: Array.from({ length: 8 }, () => ({ q: "é".repeat(140), a: "é".repeat(600) })), testimonials: Array.from({ length: 6 }, () => ({ name: "é".repeat(60), text: "é".repeat(400), place: "é".repeat(60) })), program: Array.from({ length: 14 }, () => ({ title: "é".repeat(80), text: "é".repeat(800) })) }
  it("un design maximal (≈ 44 Ko) est REFUSÉ par la validation serveur avec un message clair", () => {
    const r = sanitizeDesign(big, "voyage")
    expect(designBytes(r.design)).toBeGreaterThan(16000)
    expect(r.errors.size).toMatch(/trop volumineuse/)
  })
  it("un design raisonnable passe et reste sous la limite de la base", () => {
    const r = sanitizeDesign({ faq: [{ q: "Question ?", a: "Réponse." }], program: Array.from({ length: 7 }, (_, i) => ({ title: `Jour ${i + 1}`, text: "Visite et temps libre. ".repeat(10) })) }, "voyage")
    expect(r.errors).toEqual({})
    expect(designBytes(r.design)).toBeLessThan(MAX_DESIGN_BYTES)
  })
})

describe("clone du modèle Ramadan : services, conditions, date limite, préréglage", () => {
  it("omra : sections « services » et « conditions » autorisées ; autres familles : refusées", () => {
    const omra = sanitizeDesign({}, "omra").design.sections.map((s) => s.key)
    expect(omra).toEqual(["intro", "services", "offers", "conditions", "inclusions", "programme", "testimonials", "faq", "form"])
    expect(sanitizeDesign({ sections: [{ key: "services", visible: true }] }, "voyage").design.sections.some((s) => s.key === "services")).toBe(false)
  })
  it("services et conditions : bornés, incomplets signalés et écartés ; sections vides jamais affichées", () => {
    const r = sanitizeDesign({ services: [{ title: "Vol", text: "Tunis – Jeddah" }, { title: "Sans texte", text: "" }], conditions: [{ title: "Famille", text: "-200 DT" }] }, "omra")
    expect(r.design.services).toEqual([{ title: "Vol", text: "Tunis – Jeddah" }])
    expect(r.errors.services1).toBeTruthy()
    expect(visibleSections(r.design)).toEqual(expect.arrayContaining(["services", "conditions"]))
    expect(visibleSections(sanitizeDesign({}, "omra").design)).not.toContain("services")
    expect(sanitizeDesign({ services: Array.from({ length: 9 }, () => ({ title: "a", text: "b" })) }, "omra").errors.services).toMatch(/maximum/)
  })
  it("date limite : jour valide AAAA-MM-JJ seulement (31 février, texte, injection refusés)", () => {
    expect(sanitizeDesign({ deadline: "2026-12-15" }, "omra").design.deadline).toBe("2026-12-15")
    for (const bad of ["2026-02-31", "15/12/2026", "demain", "2026-13-01", "<script>"]) {
      const r = sanitizeDesign({ deadline: bad }, "omra")
      expect(r.errors.deadline, bad).toBeTruthy(); expect(r.design.deadline).toBe("")
    }
  })
  it("le préréglage confirmé « Omra Ramadan complet » passe la validation SANS erreur, tient dans la limite de taille et contient les données du modèle", () => {
    const theme = THEMES.find((t) => t.id === "ramadan-complet")!
    expect(theme).toMatchObject({ product: "omra", family: "omra", lang: "ar" })
    const { design, errors } = sanitizeDesign(theme.preset!.design, "omra")
    expect(errors).toEqual({})
    expect(designBytes(design)).toBeLessThan(MAX_DESIGN_BYTES)
    expect({ services: design.services.length, conditions: design.conditions.length, testimonials: design.testimonials.length, deadline: design.deadline, wa: design.cta.whatsapp }).toEqual({ services: 4, conditions: 3, testimonials: 4, deadline: "2026-12-15", wa: true })
    expect(resolvePrimary(design)).toBe("#0b162c")
    expect(design.sections.find((x) => x.key === "inclusions")!.visible).toBe(false)
    expect(visibleSections(design)).toEqual(["intro", "services", "offers", "conditions", "programme", "testimonials", "faq", "form"])
    expect(theme.preset!.offers.map((o) => [o.name, o.price])).toEqual([["غرفة رباعية أو خماسية", "5900"], ["غرفة ثلاثية", "6400"], ["غرفة ثنائية", "6900"]])
    // aucune date de départ ni nombre de nuits inventés
    expect(JSON.stringify(theme.preset!.offers)).not.toMatch(/departure_date|"nights"/)
  })
})
