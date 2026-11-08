import { describe, expect, it } from "vitest"
import { applyFormConfig, defaultFormConfig, parseFormConfig, validateFormConfigInput, type FormConfig } from "@/lib/form-config"

const cfg = (over: Partial<FormConfig> = {}): FormConfig => ({ ...defaultFormConfig(), ...over })

describe("parseFormConfig : lecture tolérante", () => {
  it("valeur absente, invalide ou corrompue → configuration par défaut", () => {
    for (const bad of [null, undefined, "x", 42, [], { fields: "x", custom: "y" }]) expect(parseFormConfig(bad)).toEqual(defaultFormConfig())
  })
  it("un champ désactivé ne peut pas être obligatoire ; clés personnalisées bornées à c1…c5, sans doublon", () => {
    const c = parseFormConfig({
      fields: { email: { enabled: false, required: true }, message: { enabled: true, required: true } },
      custom: [{ key: "c1", label: "Ville", required: true }, { key: "c1", label: "Doublon" }, { key: "c9", label: "Hors plage" }, { key: "c2", label: "  " }],
    })
    expect(c.fields.email).toEqual({ enabled: false, required: false })
    expect(c.fields.message).toEqual({ enabled: true, required: true })
    expect(c.custom).toEqual([{ key: "c1", label: "Ville", required: true }])
  })
})

describe("validateFormConfigInput", () => {
  it("nettoie les textes, numérote les champs personnalisés, limite à 5", () => {
    const r = validateFormConfigInput({
      fields: { email: { enabled: true, required: true }, offer: { enabled: false, required: true } },
      custom: Array.from({ length: 7 }, (_, i) => ({ label: `  Champ ${i + 1}\n`, required: i === 0 })),
      title: "  Mon   titre ", intro: "x".repeat(500),
    })
    expect(r.config?.custom).toHaveLength(5)
    expect(r.config?.custom[0]).toEqual({ key: "c1", label: "Champ 1", required: true })
    expect(r.config?.fields.offer).toEqual({ enabled: false, required: false })
    expect(r.config?.title).toBe("Mon titre")
    expect(r.config?.intro).toHaveLength(300)
  })
  it("refuse un champ obligatoire sans intitulé", () => {
    const r = validateFormConfigInput({ fields: {}, custom: [{ label: "", required: true }] })
    expect(r.config).toBeUndefined()
    expect(r.errors.custom_1).toMatch(/intitulé/)
  })
})

describe("applyFormConfig : application à une demande", () => {
  const config = cfg({
    fields: { email: { enabled: true, required: true }, message: { enabled: true, required: false }, offer: { enabled: false, required: true }, budget: { enabled: false, required: false } },
    custom: [{ key: "c1", label: "Ville", required: true }, { key: "c2", label: "Société", required: false }],
  })
  it("champs obligatoires manquants → erreurs par champ", () => {
    const r = applyFormConfig(config, {})
    expect(r.errors).toEqual({ email: "E-mail requis", c1: "Ville requis" })
  })
  it("un champ DÉSACTIVÉ est ignoré, même obligatoire dans une ancienne configuration ; valeurs inconnues jetées", () => {
    const r = applyFormConfig(config, { email: "a@b.tn", offer: "Offre cachée", budget: "999", custom: { c1: "Tunis", c7: "intrus" }, admin: true })
    expect(r.errors).toEqual({})
    expect(r.accepted).toEqual({ email: "a@b.tn" })
    expect(r.custom).toEqual({ c1: "Tunis" })
  })
  it("réponses bornées et nettoyées (retours à la ligne, caractères de contrôle, longueur)", () => {
    const r = applyFormConfig(config, { email: "a@b.tn", message: "ligne1\nligne2\u0000" + "x".repeat(2000), custom: { c1: "  Tu\tnis  ", c2: "y".repeat(500) } })
    expect(r.accepted.message?.length).toBeLessThanOrEqual(1000)
    expect(r.accepted.message).not.toMatch(/[\n\u0000]/)
    expect(r.custom).toEqual({ c1: "Tu nis", c2: "y".repeat(200) })
  })
  it("sans champ personnalisé renseigné : custom = null", () => {
    expect(applyFormConfig(cfg(), { custom: {} }).custom).toBeNull()
  })
})
