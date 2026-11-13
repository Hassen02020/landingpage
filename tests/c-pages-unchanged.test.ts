// PAGES /c/… EXISTANTES : leur RENDU ne doit pas changer tant que l'inventaire de production (lecture seule) n'est pas validé par le propriétaire.
// Ce test fige le rendu historique (empreinte du fichier tel qu'il est sur main, commit 60eb82e) et vérifie que /c n'utilise pas le rendu du Créateur.
// Pour le modifier un jour : valider l'inventaire (docs/INVENTAIRE_PAGES_C.md), puis mettre à jour l'empreinte ci-dessous, avec l'accord écrit du propriétaire.
import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const ROOT = new URL("..", import.meta.url).pathname
const read = (f: string) => readFileSync(ROOT + f, "utf8")
const MAIN_CATEGORYVIEW_SHA256 = "9b963bc067ee04f4f95fb669e6e887b41980b1ec7b004c7d1f040128b5834a34"

describe("pages /c/… : rendu historique inchangé", () => {
  it("app/c/[slug]/CategoryView.tsx est strictement identique à celui de main (60eb82e)", () => {
    expect(createHash("sha256").update(read("app/c/[slug]/CategoryView.tsx")).digest("hex")).toBe(MAIN_CATEGORYVIEW_SHA256)
  })
  it("la page /c/<adresse> affiche toujours CategoryView (jamais LandingView) ; LandingView n'est utilisé que par /p et par l'aperçu du Créateur", () => {
    const c = read("app/c/[slug]/page.tsx")
    expect(c).toMatch(/import \{ CategoryView \} from "\.\/CategoryView"/)
    expect(c).not.toMatch(/LandingView/)
    expect(read("app/p/[slug]/page.tsx")).toMatch(/LandingView/)
    expect(read("app/admin/createur-rendu/[id]/page.tsx")).toMatch(/LandingView/)
  })
  it("les pages /c existantes restent en dehors des moteurs de recherche ; /p aussi", () => {
    expect(read("app/robots.ts")).toMatch(/"\/c\/"/)
    expect(read("app/robots.ts")).toMatch(/"\/p\/"/)
  })
})
