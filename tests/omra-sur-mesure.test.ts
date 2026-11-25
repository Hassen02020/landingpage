import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CATEGORY, DESIGN, FAQ, MAKKAH_HOTELS, MEDINA_HOTELS, POSTER, SERVICES, VIDEO } from "@/app/omra-sur-mesure/content"
import { visibleSections } from "@/lib/page-builder/design"

// texte affiché uniquement (l'horodatage technique de la fiche n'est pas un contenu public)
const { updated_at: _u, id: _i, ...shown } = CATEGORY
const allText = JSON.stringify({ shown, DESIGN, FAQ, MAKKAH_HOTELS, MEDINA_HOTELS, SERVICES })

describe("page « Omra à la carte » (/omra-sur-mesure)", () => {
  it("est une page arabe Omra, sans offre ni prix", () => {
    expect(CATEGORY.lang).toBe("ar")
    expect(CATEGORY.product).toBe("omra")
    expect(DESIGN.hero).toBe("split") // même mise en page que /p/omra-ramadan-complet
    expect(visibleSections(DESIGN)).not.toContain("offers")
    // aucun montant : ni « 4800 », ni « د.ت » suivi d'un chiffre, ni « TND » accolé à un nombre ; les seuls nombres sont les catégories d'étoiles, distances et numéros de téléphone de la brochure
    expect(allText).not.toMatch(/\d[\d\s]{2,}\s*(د\.ت|TND|DT)/)
    expect(allText).not.toMatch(/(د\.ت|TND)\s*\d{3,}/)
  })
  it("n'invente pas de date de départ ni de taux", () => {
    expect(allText).not.toMatch(/20(26|27)/)
    expect(allText).not.toMatch(/%\s*\d|\d\s*%\s*(réduction|خصم)/)
  })
  it("reprend les catégories d'hôtel de la brochure (4 à La Mecque, 3 à Médine)", () => {
    expect(MAKKAH_HOTELS).toHaveLength(4)
    expect(MEDINA_HOTELS).toHaveLength(3)
    expect(SERVICES).toHaveLength(3)
  })
  it("a une vidéo et une affiche présentes dans public/", () => {
    expect(existsSync(`public${VIDEO}`)).toBe(true)
    expect(existsSync(`public${POSTER}`)).toBe(true)
    const video = DESIGN.blocks.find((b) => b.type === "video")
    expect(video?.video).toBe(VIDEO)
  })
  it("le formulaire est celui du CRM : e-mail facultatif, région, voyageurs, WhatsApp", () => {
    expect(DESIGN.form.email).toBe(true)
    expect(DESIGN.form.region).toBe(true)
    expect(DESIGN.cta.whatsapp).toBe(true)
    const page = readFileSync("app/omra-sur-mesure/page.tsx", "utf8")
    expect(page).toContain("LandingView")
    expect(page).toContain("offers={[]}")
  })
})
