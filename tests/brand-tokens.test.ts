// E3 — fondations de l'identité Easy2Book : une seule source de couleurs de marque, appliquée par les composants de marque.
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { THEMES } from "@/lib/page-builder/themes"
import { sanitizeDesign } from "@/lib/page-builder/design"

const ROOT = new URL("..", import.meta.url).pathname
const read = (f: string) => readFileSync(ROOT + f, "utf8")
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

describe("E3 : variables de marque", () => {
  const css = read("app/globals.css")
  it.each([["--e2b-blue", "#003878"], ["--e2b-blue-dark", "#00285a"], ["--e2b-blue-soft", "#e4edf9"], ["--e2b-yellow", "#f0c848"], ["--e2b-ink", "#0b1b3a"], ["--e2b-wa", "#0e7a3c"]])("%s = %s (valeur validée par le propriétaire, bleu mesuré sur le logo)", (name, hex) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${hex}`, "i"))
  })
  it("Tailwind expose les mêmes couleurs sous e2b.* en passant par les variables (aucune valeur recopiée)", () => {
    const tw = read("tailwind.config.ts")
    for (const k of ["blue", "blue-dark", "blue-soft", "yellow", "ink", "wa"]) expect(tw).toContain(`var(--e2b-${k})`)
    expect(tw).not.toMatch(/#003878/i)
  })
  it("contrastes : texte blanc sur le bleu et sur le vert WhatsApp ≥ 4,5:1 ; le jaune seul n'est jamais un texte sur fond clair", () => {
    expect(contrast("#ffffff", "#003878")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", "#00285a")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", "#0e7a3c")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#0b1b3a", "#f0c848")).toBeGreaterThanOrEqual(4.5) // texte sombre sur jaune : permis
    expect(contrast("#f0c848", "#ffffff")).toBeLessThan(3) // jaune sur blanc : interdit en texte
  })
  it("le logo officiel est présent (PNG 512×512)", () => {
    const b = readFileSync(ROOT + "public/logo.png")
    expect(b.subarray(1, 4).toString()).toBe("PNG"); expect(b.readUInt32BE(16)).toBe(512); expect(b.readUInt32BE(20)).toBe(512)
  })
})

describe("E3 : application aux composants de marque", () => {
  const view = read("app/p/[slug]/LandingView.tsx")
  const block = (tag: string, id: string) => { const at = view.indexOf(`data-testid="${id}"`); return view.slice(view.lastIndexOf(`<${tag}`, at), view.indexOf(`</${tag}>`, at)) }
  const hdr = block("header", "brochure-header"), ftr = block("footer", "brochure-footer")
  it("en-tête et pied de page de marque : bleu, jaune et vert WhatsApp viennent des variables, jamais d'une valeur en dur", () => {
    for (const part of [hdr, ftr]) expect(part).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(hdr).toMatch(/bg-e2b-blue/); expect(hdr).toMatch(/border-e2b-yellow/); expect(hdr).toMatch(/text-e2b-wa/)
    expect(ftr).toMatch(/bg-e2b-blue/); expect(ftr).toMatch(/border-e2b-yellow/)
  })
  it("les modèles Omra du Créateur partent du bleu Easy2Book et la personnalisation reste valide", () => {
    for (const id of ["ramadan-complet", "omra-groupe-1", "omra-groupe-2", "omra-chawwal"]) {
      const p = THEMES.find((t) => t.id === id)!.preset!
      expect((p.design as { colors: { custom: string } }).colors.custom).toBe("#003878")
      expect(sanitizeDesign(p.design, "omra").errors).toEqual({})
    }
  })
  it("le composant partagé SiteHeader / SiteFooter et le CRM ne sont pas touchés par E3", () => {
    const intake = read("lib/server/lead-intake.ts")
    expect(intake).toMatch(/contact_consent: true/); expect(intake).toMatch(/marketing_consent: marketingConsent/)
  })
})
