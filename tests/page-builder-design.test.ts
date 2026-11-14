import { describe, expect, it } from "vitest"
import { THEMES } from "@/lib/page-builder/themes"
import { LEGACY_DESIGN_BYTES, MAX_DESIGN_BYTES, designBytes, sectionLabel, contrastWithWhite, defaultDesign, resolvePrimary, sanitizeDesign, tint, visibleSections } from "@/lib/page-builder/design"

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

describe("taille : deux paliers (0018 : 15 000 octets ; 0022 : 60 000 octets)", () => {
  const big = { faq: Array.from({ length: 8 }, () => ({ q: "é".repeat(140), a: "é".repeat(600) })), testimonials: Array.from({ length: 6 }, () => ({ name: "é".repeat(60), text: "é".repeat(400), place: "é".repeat(60) })), program: Array.from({ length: 14 }, () => ({ title: "é".repeat(80), text: "é".repeat(800) })) }
  const blocks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `blk${String(i).padStart(3, "0")}`, type: "text", title: "Bloc", text: "😀".repeat(600) }))
  it("un design de ≈ 44 Ko est ACCEPTÉ par le serveur (palier 0022) mais signalé comme dépassant le palier 0018", () => {
    const r = sanitizeDesign(big, "voyage")
    expect(r.errors.size).toBeUndefined()
    expect(designBytes(r.design)).toBeGreaterThan(LEGACY_DESIGN_BYTES)
    expect(designBytes(r.design)).toBeLessThan(MAX_DESIGN_BYTES)
  })
  it("au-delà de 60 000 octets : REFUSÉ avec un message clair, quel que soit le contenu", () => {
    const r = sanitizeDesign({ ...big, blocks: blocks(12) }, "voyage")
    expect(designBytes(r.design)).toBeGreaterThan(MAX_DESIGN_BYTES)
    expect(r.errors.size).toMatch(/trop volumineuse/)
  })
  it("un design raisonnable passe et reste sous le palier 0018", () => {
    const r = sanitizeDesign({ faq: [{ q: "Question ?", a: "Réponse." }], program: Array.from({ length: 7 }, (_, i) => ({ title: `Jour ${i + 1}`, text: "Visite et temps libre. ".repeat(10) })) }, "voyage")
    expect(r.errors).toEqual({})
    expect(designBytes(r.design)).toBeLessThan(LEGACY_DESIGN_BYTES)
  })
})

describe("blocs personnalisés", () => {
  const B = (o: Record<string, unknown> = {}) => ({ id: "abcd12", type: "text", title: "Notre hôtel", text: "Un hôtel calme à 200 m du Haram.", ...o })
  it("un bloc valide est conservé ; il est placé avant la FAQ, visible ; sections existantes inchangées", () => {
    const { design, errors } = sanitizeDesign({ blocks: [B()] }, "omra")
    expect(errors).toEqual({})
    expect(design.blocks).toEqual([{ id: "abcd12", type: "text", title: "Notre hôtel", text: "Un hôtel calme à 200 m du Haram.", items: [], images: [], cta: "form", ctaLabel: "", video: "" }])
    const keys = design.sections.map((s) => s.key)
    expect(keys.indexOf("block:abcd12")).toBe(keys.indexOf("faq") - 1)
    expect(keys.filter((k) => !k.startsWith("block:"))).toEqual(["intro", "services", "offers", "conditions", "inclusions", "programme", "testimonials", "faq", "form"])
    expect(visibleSections(design)).toContain("block:abcd12")
  })
  it("les 7 types sont validés : éléments, images, texte et bouton requis selon le type ; blocs incomplets signalés ET écartés", () => {
    const ok = sanitizeDesign({ blocks: [
      B({ id: "t0001", type: "benefits", text: "", items: [{ title: "Proche du Haram", text: "" }] }),
      B({ id: "t0002", type: "steps", text: "", items: [{ title: "Jour 1", text: "Arrivée" }, { title: "Jour 2", text: "" }] }),
      B({ id: "t0003", type: "gallery", text: "", images: ["https://cdn.test/a.jpg", "/local/b.jpg"] }),
      B({ id: "t0004", type: "image_text", images: ["https://cdn.test/c.jpg", "https://cdn.test/ignoree.jpg"] }),
      B({ id: "t0005", type: "cta", text: "", cta: "whatsapp", ctaLabel: "" }),
      B({ id: "t0006", type: "notice" }),
    ] }, "voyage")
    expect(ok.errors).toEqual({})
    expect(ok.design.blocks.map((b) => b.type)).toEqual(["benefits", "steps", "gallery", "image_text", "cta", "notice"])
    expect(ok.design.blocks[3].images).toEqual(["https://cdn.test/c.jpg"])
    expect(ok.design.blocks[4]).toMatchObject({ cta: "whatsapp", ctaLabel: "Réserver" })
    const bad = sanitizeDesign({ blocks: [B({ id: "b0001", type: "benefits", items: [] }), B({ id: "b0002", type: "gallery", images: [] }), B({ id: "b0003", type: "image_text", images: [] }), B({ id: "b0004", text: "" }), B({ id: "b0005", title: "" }), B({ id: "b0006", type: "pirate" }), B({ id: "bad id!" })] }, "voyage")
    expect(Object.keys(bad.errors).sort()).toEqual(["block0", "block1", "block2", "block3", "block4", "block5", "block6"])
    expect(bad.design.blocks).toEqual([])
  })
  it("INJECTION : images en https:// ou « /… » seulement (javascript:, data:, http://, espaces, guillemets refusés) ; textes en texte brut", () => {
    for (const u of ["javascript:alert(1)", "data:text/html;base64,AAAA", "http://x.test/a.jpg", "https://x.test/a b.jpg", 'https://x.test/"onerror=1', "//evil.test/a.jpg", "ftp://x/a"]) {
      const r = sanitizeDesign({ blocks: [B({ type: "gallery", images: [u] })] }, "voyage")
      expect(r.errors.block0, u).toMatch(/Image/); expect(r.design.blocks).toEqual([])
    }
    const r = sanitizeDesign({ blocks: [B({ title: "<script>alert(1)</script>", text: "<img src=x onerror=alert(2)>" })] }, "voyage")
    expect(r.design.blocks[0].title).toBe("<script>alert(1)</script>") // conservé tel quel : il sera ÉCHAPPÉ au rendu (testé dans category-view)
  })
  it("bornes : 12 blocs, 12 éléments, 8 images ; identifiants uniques ; types de sections des autres familles refusés", () => {
    const many = sanitizeDesign({ blocks: Array.from({ length: 15 }, (_, i) => B({ id: `bl${String(i).padStart(4, "0")}`, title: `B${i}` })) }, "voyage")
    expect(many.design.blocks).toHaveLength(12); expect(many.errors.blocks).toMatch(/maximum/)
    expect(sanitizeDesign({ blocks: [B({ type: "benefits", items: Array.from({ length: 20 }, (_, i) => ({ title: `i${i}`, text: "" })) })] }, "voyage").design.blocks[0].items).toHaveLength(12)
    expect(sanitizeDesign({ blocks: [B({ type: "gallery", images: Array.from({ length: 12 }, (_, i) => `https://x.test/${i}.jpg`) })] }, "voyage").design.blocks[0].images).toHaveLength(8)
    const dup = sanitizeDesign({ blocks: [B(), B({ title: "Autre" })] }, "voyage")
    expect(dup.design.blocks).toHaveLength(1); expect(dup.errors.block1).toMatch(/dupliqué/)
  })
  it("ordre : un bloc se déplace librement parmi les sections, peut être masqué ; une clé « block:… » sans bloc est ignorée ; « form » reste visible", () => {
    const { design } = sanitizeDesign({ blocks: [B()], sections: [{ key: "block:abcd12", visible: true }, { key: "block:fantome", visible: true }, { key: "form", visible: false }, { key: "offers", visible: true }] }, "voyage")
    const keys = design.sections.map((s) => s.key)
    expect(keys.slice(0, 3)).toEqual(["block:abcd12", "form", "offers"]); expect(keys).not.toContain("block:fantome")
    expect(design.sections.find((s) => s.key === "form")!.visible).toBe(true)
    const hidden = sanitizeDesign({ blocks: [B()], sections: [{ key: "block:abcd12", visible: false }] }, "voyage").design
    expect(visibleSections(hidden)).not.toContain("block:abcd12")
    expect(sectionLabel(design, "block:abcd12")).toBe("Bloc « Notre hôtel »")
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
    expect(visibleSections(design)).toEqual(["intro", "block:vid0001", "services", "offers", "conditions", "programme", "testimonials", "faq", "form"])
    expect(theme.preset!.offers.map((o) => [o.name, o.price])).toEqual([["غرفة رباعية أو خماسية", "5900"], ["غرفة ثلاثية", "6400"], ["غرفة ثنائية", "6900"]])
    // aucune date de départ ni nombre de nuits inventés
    expect(JSON.stringify(theme.preset!.offers)).not.toMatch(/departure_date|"nights"/)
  })
})
