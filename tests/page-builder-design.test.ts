import { describe, expect, it } from "vitest"
import { contrastWithWhite, defaultDesign, resolvePrimary, sanitizeDesign, tint, visibleSections } from "@/lib/page-builder/design"

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
