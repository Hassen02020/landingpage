// LOT 1 — design system de l'espace équipe : échelle brand-* dérivée du bleu Easy2Book, focus visible,
// statuts par phase, composants partagés. Aucune règle métier testée ici n'est modifiée (libellés de lib/status.ts).
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import * as ReactNs from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { STATUSES, STATUS_LABELS } from "@/lib/status"
import { NAV_GROUPS } from "@/lib/admin-nav"
import { PHASE_LABELS, STATUS_COLORS, formatTnd, statusPhase } from "@/app/admin/format"
import { EmptyState, Notice, Skeleton, StatusBadge } from "@/app/admin/(crm)/_components/ui"

// même convention que fallback-routes.test : transformation JSX classique en test
;(globalThis as { React?: unknown }).React = (ReactNs as { default?: unknown }).default ?? ReactNs

const ROOT = new URL("..", import.meta.url).pathname
const read = (f: string) => readFileSync(ROOT + f, "utf8")
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const css = read("app/globals.css")
const v = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1]

const walk = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((f) => { const p = join(dir, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [] })

describe("LOT 1 : échelle brand-* (bleu Easy2Book)", () => {
  it("Tailwind expose brand-* uniquement via les variables --e2b-* ; 700 = bleu du logo, 800 = bleu foncé, 100 = bleu clair", () => {
    const tw = read("tailwind.config.ts")
    expect(tw).toMatch(/700: "var\(--e2b-blue\)"/)
    expect(tw).toMatch(/800: "var\(--e2b-blue-dark\)"/)
    expect(tw).toMatch(/100: "var\(--e2b-blue-soft\)"/)
    expect(tw).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
  it("contrastes WCAG AA des nuances utilisées en texte ou en fond de bouton", () => {
    for (const n of ["500", "600", "900"]) expect(contrast(v(`--e2b-blue-${n}`), "#ffffff"), `brand-${n} / blanc`).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", v("--e2b-blue-dark"))).toBeGreaterThanOrEqual(7) // menu latéral (bleu foncé officiel)
    expect(contrast(v("--e2b-blue-200"), v("--e2b-blue-dark"))).toBeGreaterThanOrEqual(4.5) // titres de groupes du menu
    expect(contrast(v("--e2b-blue-dark"), v("--e2b-blue-50"))).toBeGreaterThanOrEqual(4.5) // badge « en cours »
    expect(contrast(v("--e2b-yellow"), v("--e2b-blue-dark"))).toBeGreaterThanOrEqual(3) // focus jaune sur le menu (2.4.11 : 3:1)
  })
  it("focus clavier visible et mouvement réduit définis pour l'espace équipe", () => {
    expect(css).toMatch(/\.admin-root :focus-visible\s*\{\s*outline: 3px solid/)
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.admin-root \*/)
  })
  it("plus aucune classe violette dans l'espace équipe, sauf l'aperçu du thème « autre » des landing pages (violet par conception)", () => {
    const offenders = walk("app/admin").filter((f) => /\bviolet-\d/.test(read(f)) && !f.endsWith("createur/modeles/page.tsx"))
    expect(offenders).toEqual([])
    for (const f of ["app/not-found.tsx", "app/error.tsx", "app/components/NotFoundActions.tsx"]) expect(read(f)).not.toMatch(/violet-/)
    // boutons WhatsApp des pages 404 / erreur : vert accessible validé (blanc 5,43:1), plus le green-600 à ~3,3:1
    for (const f of ["app/error.tsx", "app/components/NotFoundActions.tsx"]) { expect(read(f)).toMatch(/bg-e2b-wa\b/); expect(read(f)).not.toMatch(/bg-green-600/) }
  })
})

describe("LOT 1 : statuts par phase (présentation seule)", () => {
  it("chaque statut a une couleur et une phase ; vendu = réservé / gagné, à traiter = nouveau / à contacter", () => {
    for (const s of STATUSES) expect(STATUS_COLORS[s], s).toBeTruthy()
    expect(STATUSES.filter((s) => statusPhase(s) === "vendu")).toEqual(["reserve", "gagne"])
    expect(STATUSES.filter((s) => statusPhase(s) === "a_traiter")).toEqual(["nouveau", "a_contacter"])
    expect(statusPhase("perdu")).toBe("perdu")
    expect(statusPhase("devis")).toBe("en_cours")
  })
  it("le badge garde le libellé officiel, ajoute un point décoratif et la phase pour les lecteurs d'écran", () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: "reserve" }))
    expect(html).toContain(STATUS_LABELS.reserve)
    expect(html).toContain(`phase : ${PHASE_LABELS.vendu}`)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-phase="vendu"')
  })
})

describe("LOT 1 : composants partagés", () => {
  it("Notice : erreur annoncée (alert), information en statut", () => {
    expect(renderToStaticMarkup(createElement(Notice, { tone: "error", children: "x" }))).toContain('role="alert"')
    expect(renderToStaticMarkup(createElement(Notice, { children: "x" }))).toContain('role="status"')
  })
  it("EmptyState et Skeleton : aucun chiffre affiché ; chargement annoncé", () => {
    const sk = renderToStaticMarkup(createElement(Skeleton))
    expect(sk).toContain('aria-busy="true"'); expect(sk).toContain("Chargement"); expect(sk).not.toMatch(/\d+ ?TND/)
    expect(renderToStaticMarkup(createElement(EmptyState, { title: "Aucun lead" }))).toContain("Aucun lead")
  })
  it("formatTnd : affichage seul, sans décimale par défaut", () => {
    expect(formatTnd(1200).replace(/\s/g, " ")).toBe("1 200 TND")
    expect(formatTnd(12.345, 2).replace(/\s/g, " ")).toBe("12,35 TND")
  })
  it("aucun loading.tsx au niveau des routes de l'espace équipe : il ferait passer les 404 neutres (dossier d'un collègue) en 200", () => {
    expect(walk("app/admin").filter((f) => f.endsWith("loading.tsx"))).toEqual([])
  })
})

describe("LOTS 2-3 : navigation, tableau de bord, pipeline, fiche dossier (présentation seule)", () => {
  it("menu : une icône par concept pour les entrées qui se confondaient (aucune page, route ni droit modifiés)", () => {
    const icon = (label: string) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.label === label)!.icon
    const distinct = ["À traiter", "Relances", "Doublons", "Segments", "Rentabilité", "Clients", "Conversations", "Avis des visiteurs", "Formulaire"].map(icon)
    expect(new Set(distinct).size).toBe(distinct.length)
    expect(NAV_GROUPS.flatMap((g) => g.items).length).toBe(27) // aucune entrée supprimée (27 au 26/11/2026)
  })
  it("fiche dossier : les actions (statut, relance, responsable) viennent avant les blocs d'information", () => {
    const src = read("app/admin/(crm)/leads/[id]/page.tsx")
    const actions = src.indexOf('data-testid="lead-actions"')
    expect(actions).toBeGreaterThan(0)
    for (const marker of ['data-testid="duplicates"', "Messages WhatsApp prêts", ">Demande</h2>", "Attribution et consentements"]) expect(actions, marker).toBeLessThan(src.indexOf(marker))
  })
  it("pipeline : colonnes empilées sur mobile, boutons d'action ≥ 44 px, plafond de 100 cartes annoncé", () => {
    const src = read("app/admin/(crm)/pipeline/page.tsx")
    expect(src).toMatch(/flex-col[^"]*sm:flex-row/); expect(src).toMatch(/min-h-\[44px\]/); expect(src).toMatch(/100 sur \$\{list\.length\}/)
  })
  it("tableaux de l'espace équipe : en-têtes de colonne déclarés (scope) dans les listes principales", () => {
    for (const f of ["app/admin/(crm)/page.tsx", "app/admin/(crm)/clients/page.tsx"]) expect(read(f)).toMatch(/<th scope="col"/)
  })
  it("tableau de bord : valeur, libellé et sous-texte séparés (le montant n'est plus collé au libellé)", () => {
    const src = read("app/admin/(crm)/page.tsx")
    expect(src).not.toMatch(/label=\{`[^`]*·[^`]*tnd/); expect(src).toMatch(/hint=\{`\$\{tnd\(dash\.revenueMonth\)\}/)
  })
})
