// L3 (Q1-A, Q8-A) — matrice « page × rôle » par lecture du code : aucune page de l'espace équipe n'échappe à un contrôle de droit
// SANS avoir été classée volontairement « sûre pour l'employé ». Une nouvelle page doit être classée ici (garde ou liste blanche).
// Les pages de la liste blanche ne lisent que des leads (restreints aux dossiers affectés par lib/server/db.ts pour un employé),
// ou aucune donnée financière. Preuve par lecture du code : non vérifié en interface réelle (aucun compte employé en production).
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { can } from "@/lib/permissions"

const ROOT = new URL("..", import.meta.url).pathname
const CRM = "app/admin/(crm)"
const walk = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((f) => { const p = join(dir, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith("/page.tsx") ? [p] : [] })
const pages = walk(CRM).map((p) => ({ route: p.slice(CRM.length + 1, -"/page.tsx".length) || "(accueil)", src: readFileSync(join(ROOT, p), "utf8") }))
const GUARD = /\bcan\(|builderAccess\(/

// Pages sans contrôle de droit propre : données = dossiers de l'employé (restriction serveur) ou aucune donnée financière.
// (L'accueil et la fiche dossier utilisent can() pour adapter l'affichage — non-employé / export — mais restent ouverts à l'employé pour SES dossiers.)
const OPEN_TO_EMPLOYEE = ["calculateur", "clients", "clients/[phone]", "compte", "leads/new", "liens", "pipeline"]

describe("L3 : pages de l'espace équipe et droits de l'employé", () => {
  it("toute page sans contrôle de droit est classée volontairement (liste blanche)", () => {
    const unguarded = pages.filter((p) => !GUARD.test(p.src)).map((p) => p.route).sort()
    expect(unguarded).toEqual([...OPEN_TO_EMPLOYEE].sort())
  })
  it("les vues chiffrées d'organisation exigent un droit que l'employé n'a pas", () => {
    for (const perm of ["reports.view", "ads.view", "ads.manage", "leads.view_all", "data.export", "employees.view"] as const) expect(can("employee", perm), perm).toBe(false)
    const need: Record<string, RegExp> = {
      "intelligence": /reports\.view|ads\.view/, "intelligence/dirigeant": /reports\.view|ads\.view/, "intelligence/qualite": /reports\.view|ads\.view/,
      "rentabilite": /ads\.(view|manage)/, "rentabilite/analyse": /ads\.view/, "segments": /reports\.view/, "canaux": /reports\.view/, "conversations": /leads\.view_all/,
    }
    for (const [route, re] of Object.entries(need)) expect(pages.find((p) => p.route === route)?.src, route).toMatch(re)
  })
  it("statistiques : l'employé n'a que « Mes chiffres », les onglets de l'organisation exigent reports.view", () => {
    const src = pages.find((p) => p.route === "stats")!.src
    expect(src).toMatch(/reports\.view/); expect(src).toMatch(/Mes chiffres/)
  })
  it("l'accès aux données de dossiers reste restreint côté serveur (lib/server/db.ts), pas par l'affichage", () => {
    const db = readFileSync(join(ROOT, "lib/server/db.ts"), "utf8")
    expect(db).toMatch(/assigned_to=eq\.\$\{me\}/); expect(db).toMatch(/employeeLeadScope/)
  })
})
