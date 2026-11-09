import { describe, expect, it } from "vitest"
import { VOYAGES, VOYAGE_CATEGORIES } from "@/app/voyages-organises/data"
import { HOTEL_PROMOS } from "@/app/summer-vibes/data/hotel-promos"

// Garde-fous sur les données publiques issues des fichiers Excel du propriétaire (09/11/2026).
describe("voyages organisés (voyages_organises_easy2book.xlsx)", () => {
  it("19 départs valables, identifiants uniques, catégories connues", () => {
    expect(VOYAGES).toHaveLength(19)
    expect(new Set(VOYAGES.map((v) => v.id)).size).toBe(19)
    for (const v of VOYAGES) expect(VOYAGE_CATEGORIES).toContain(v.category)
  })
  it("dates réelles au format AAAA-MM-JJ, prix positifs, durée et destination renseignées", () => {
    for (const v of VOYAGES) {
      expect(v.departIso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(v.departIso))).toBe(false)
      expect(v.priceFrom).toBeGreaterThan(0)
      expect(v.duration.length).toBeGreaterThan(3)
      expect(v.destination.length).toBeGreaterThan(1)
    }
  })
  it("quelques valeurs vérifiées une à une contre le fichier", () => {
    const by = (t: string) => VOYAGES.find((v) => v.title.startsWith(t))!
    expect(by("Australie")).toMatchObject({ category: "Premium", departIso: "2026-11-14", priceFrom: 18500, visa: "non_precise" })
    expect(by("Sri Lanka")).toMatchObject({ departIso: "2026-12-10", priceFrom: 13890, visa: "avec" })
    expect(by("Istanbul Spécial")).toMatchObject({ category: "Standard", departIso: "2026-11-09", priceFrom: 1950 })
    expect(by("Argentine : glaciers")).toMatchObject({ category: "Individuel garanti", priceFrom: 26820 })
  })
  it("répartition par catégorie conforme au fichier (9 Premium, 6 Individuel garanti, 4 Standard)", () => {
    const n = (c: string) => VOYAGES.filter((v) => v.category === c).length
    expect([n("Premium"), n("Individuel garanti"), n("Standard")]).toEqual([9, 6, 4])
  })
})

describe("promos hôtels Tunisie (promos_hotels_tunisie_active_travel.xlsx)", () => {
  it("29 hôtels, noms uniques, réductions 1 à 99 %, prix positifs", () => {
    expect(HOTEL_PROMOS).toHaveLength(29)
    expect(new Set(HOTEL_PROMOS.map((h) => h.name)).size).toBe(29)
    for (const h of HOTEL_PROMOS) {
      expect(h.discount).toBeGreaterThan(0)
      expect(h.discount).toBeLessThan(100)
      expect(h.priceFrom).toBeGreaterThan(0)
    }
  })
  it("valeurs vérifiées contre le fichier, remarques non ambiguës seulement", () => {
    const by = (n: string) => HOTEL_PROMOS.find((h) => h.name === n)!
    expect(by("Houria Palace")).toMatchObject({ city: "Sousse", discount: 44, priceFrom: 58.7 })
    expect(by("Best Beach Hotel")).toMatchObject({ discount: 48, priceFrom: 44.5 })
    expect(by("Iberostar Waves Averroes").priceFrom).toBe(160.125) // valeur exacte du fichier, jamais arrondie
    expect(by("Seabel Alhambra Beach Golf & Spa").priceFrom).toBe(191.875)
    expect(by("Sol Palmeras Beach").note).toBe("Premier enfant de moins de 6 ans gratuit")
    expect(by("Marhaba Club").note).toBe("Réservé aux non-célibataires")
    expect(by("Laico Hammamet").note).toBeNull() // « 1er -5 ans » (non explicité) : volontairement non affichée
  })
  it("aucune donnée de lien externe (liens Active Travel écartés par décision du propriétaire)", () => {
    expect(JSON.stringify(HOTEL_PROMOS)).not.toMatch(/activetravel|https?:/i)
  })
})
