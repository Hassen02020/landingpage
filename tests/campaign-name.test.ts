import { describe, expect, it } from "vitest"
import { isConventionalCampaign, suggestCampaignName } from "../lib/campaign-name"

describe("convention de nommage", () => {
  it("accepte minuscules, chiffres, tirets", () => {
    for (const ok of ["omra-ramadan-2027", "turquie-circuit-2027-avril", "a", "x1-y2"]) expect(isConventionalCampaign(ok), ok).toBe(true)
  })
  it("refuse majuscules, espaces, accents, tirets de bord ou doublés, underscores, vide", () => {
    for (const bad of ["Omra-2027", "omra 2027", "omra-été", "-omra", "omra-", "omra--2027", "omra_2027", ""]) expect(isConventionalCampaign(bad), bad).toBe(false)
  })
  it("propose le nom conforme le plus proche", () => {
    expect(suggestCampaignName("Omra Ramadan 2027")).toBe("omra-ramadan-2027")
    expect(suggestCampaignName("  Séjour_Été 2027! ")).toBe("sejour-ete-2027")
    expect(suggestCampaignName("")).toBe("")
  })
})
