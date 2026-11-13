// PREUVE : toute personnalisation ACCEPTÉE par le serveur respecte la contrainte PostgreSQL
//   CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 16000))
// La contrainte est lue DANS le fichier 0018 (aucune copie à la main) et exécutée sur PostgreSQL de test (PGlite).
// Ces essais ne prouvent rien sur la base de production ; ils démontrent la méthode de mesure.
import { beforeAll, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { MAX_DESIGN_BYTES, designBytes, pgJsonText, sanitizeDesign, type PageDesign } from "@/lib/page-builder/design"
import type { Family } from "@/lib/page-builder/themes"

const M18 = readFileSync(new URL("../supabase/migrations/0018_page_design.sql", import.meta.url), "utf8")
const CHECK = /CHECK \((design IS NULL OR [\s\S]*?<= 16000\))\)/.exec(M18)![1]
const LIMIT = Number(/<= (\d+)\)/.exec(CHECK)![1])
let db: PGlite
const pgBytes = async (v: unknown) => (await db.query<{ n: number }>(`SELECT octet_length(($1::jsonb)::text) AS n`, [JSON.stringify(v)])).rows[0].n
const pgText = async (v: unknown) => (await db.query<{ t: string }>(`SELECT ($1::jsonb)::text AS t`, [JSON.stringify(v)])).rows[0].t
let id = 0
/** insère la valeur DANS une table portant exactement la contrainte de 0018 : true = acceptée par la base */
const dbAccepts = async (v: unknown): Promise<boolean> => {
  try { await db.query(`INSERT INTO d (id, design) VALUES ($1, $2::jsonb)`, [++id, JSON.stringify(v)]); return true } catch { return false }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE TABLE d (id int PRIMARY KEY, design jsonb, CONSTRAINT landing_categories_design_check CHECK (${CHECK}))`)
}, 60000)

// générateur pseudo-aléatoire reproductible
let seed = 20261114
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const ALPHA = ["a", "Z", "é", "à", "ç", "€", "ع", "ر", "😀", "🕋", "𝒜", " ", " ", "\"", "\\", "/", "\n", "\t", "\u0001", "\u007f", "\ud83d", "\ude00", "<b>", "&", "'", " "]
const text = (n: number) => { let t = ""; for (let i = 0; i < n; i++) t += pick(ALPHA); return t }

describe("mesure serveur = mesure PostgreSQL", () => {
  it("la contrainte lue dans 0018 est bien octet_length(design::text) <= 16000", () => {
    expect(LIMIT).toBe(16000)
    expect(MAX_DESIGN_BYTES).toBeLessThan(LIMIT)
    expect(CHECK).toContain("octet_length(design::text)")
  })
  it("sérialisation : PostgreSQL met « : » et « , » suivis d'une espace (JSON.stringify non) — pgJsonText reproduit exactement la longueur PostgreSQL", async () => {
    const samples: unknown[] = [
      {}, [], { a: 1 }, { v: 1, sections: Array.from({ length: 9 }, (_, i) => ({ key: "k" + i, visible: i % 2 === 0 })) },
      { t: "é€😀 \u007f\"\\\n\t\u0001/\u0080\u009f" }, { zz: [[], {}, [{}], [[]]], a: true, m: false, n: null, "clé é": "😀" },
      { x: "".padEnd(300, "ab") }, { a: Array.from({ length: 200 }, (_, i) => ({ q: "x" + i, a: "y", b: true })) },
    ]
    for (const s of samples) {
      expect(new TextEncoder().encode(pgJsonText(s)).length, JSON.stringify(s).slice(0, 50)).toBe(await pgBytes(s))
    }
    // l'écart avec JSON.stringify existe bel et bien (c'est la raison de cette mesure)
    const dense = { s: Array.from({ length: 100 }, (_, i) => ({ k: "a", v: true, i: String(i) })) }
    expect(await pgBytes(dense)).toBeGreaterThan(new TextEncoder().encode(JSON.stringify(dense)).length + 200)
  })
  it("texte identique à celui de PostgreSQL (hors ordre des clés, sans effet sur la taille)", async () => {
    const v = { b: ["x", { d: 1, c: "é" }], a: true }
    const sorted = (x: unknown): unknown => (Array.isArray(x) ? x.map(sorted) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sorted((x as Record<string, unknown>)[k])])) : x)
    const norm = (t: string) => JSON.stringify(sorted(JSON.parse(t)))
    expect(norm(pgJsonText(v))).toBe(norm(await pgText(v)))
  })
})

describe("garantie : accepté par le serveur ⇒ accepté par la base", () => {
  const families: Family[] = ["omra", "voyage", "hotel", "autre"]
  const rawDesign = (heavy: boolean) => {
    const n = (max: number) => (heavy ? max : Math.floor(rnd() * (max + 1)))
    return {
      colors: { preset: pick(["bleu", "rouge", "famille", "inconnu"]), custom: rnd() < 0.5 ? "#1d4ed8" : text(5) },
      background: pick(["blanc", "teinte", "famille", "x"]),
      cta: { label: text(n(60)), whatsapp: rnd() < 0.5 },
      price: { prefix: rnd() < 0.5, showBefore: rnd() < 0.5 },
      form: { email: rnd() < 0.5 },
      sections: Array.from({ length: 12 }, () => ({ key: pick(["intro", "highlights", "offers", "inclusions", "programme", "gallery", "testimonials", "faq", "form", "x"]), visible: rnd() < 0.7 })),
      faq: Array.from({ length: n(10) }, () => ({ q: text(n(160)), a: text(n(700)) })),
      testimonials: Array.from({ length: n(8) }, () => ({ name: text(n(70)), text: text(n(450)), place: text(n(70)) })),
      program: Array.from({ length: n(16) }, () => ({ title: text(n(90)), text: text(n(900)) })),
    }
  }
  const verify = async (raw: unknown, family: Family) => {
    const { design, errors } = sanitizeDesign(raw, family)
    const bytes = designBytes(design)
    if (errors.size) { expect(bytes).toBeGreaterThan(MAX_DESIGN_BYTES); return "refusé" as const }
    // accepté : taille ≤ limite serveur, égale à celle de PostgreSQL, et la base l'accepte
    expect(bytes).toBeLessThanOrEqual(MAX_DESIGN_BYTES)
    expect(await pgBytes(design)).toBe(bytes)
    expect(await dbAccepts(design)).toBe(true)
    return "accepté" as const
  }
  it("400 designs aléatoires (texte multi-octets, emojis coupés, substituts isolés, échappements, listes pleines ou vides) : aucun accepté n'est refusé par la base", async () => {
    const tally = { accepté: 0, refusé: 0 }
    for (let i = 0; i < 400; i++) tally[await verify(rawDesign(i % 3 === 0), pick(families))]++
    expect(tally.accepté).toBeGreaterThan(100)
    expect(tally.refusé).toBeGreaterThan(20) // les deux issues sont réellement exercées
  }, 120000)
  it("cas limite : le plus gros design ACCEPTABLE (réglé à l'octet près sous 15 000) passe la contrainte, avec marge", async () => {
    let best: PageDesign | null = null
    for (const filler of ["a", "é", "😀", "\n", "\""]) {
      // budget de caractères réparti sur le programme, la FAQ et les témoignages, agrandi jusqu'à la dernière taille acceptée par le serveur
      const fill = (n: number) => (n === 0 ? "" : n === 1 ? "x" : "x" + filler.repeat(Math.ceil(n / filler.length)).slice(0, n - 2) + "x") // « x » aux deux bouts : un texte de retours à la ligne serait vidé par le nettoyage (trim)
      const build = (k: number) => {
        let left = k
        const take = (cap: number) => { const n = Math.min(cap, left); left -= n; return fill(n) }
        const program = Array.from({ length: 14 }, () => ({ title: "T", text: take(800) || "x" }))
        const faq = Array.from({ length: 8 }, () => ({ q: "Q", a: take(600) || "x" }))
        const testimonials = Array.from({ length: 6 }, () => ({ name: "N", text: take(400) || "x", place: "" }))
        return sanitizeDesign({ program, faq, testimonials }, "voyage")
      }
      let lo = 0, hi = 20000
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (!build(mid).errors.size) lo = mid; else hi = mid - 1 }
      const r = build(lo)
      expect(r.errors.size).toBeUndefined()
      expect(build(lo + 1).errors.size === undefined && lo < 20000).toBe(false) // un caractère de plus et le serveur refuse : on est bien à la limite
      const b = designBytes(r.design)
      expect(b).toBeLessThanOrEqual(MAX_DESIGN_BYTES)
      expect(b).toBeGreaterThan(MAX_DESIGN_BYTES - 5 * 4) // à quelques octets de la limite (le dernier caractère peut peser jusqu'à 4 octets)
      expect(await pgBytes(r.design)).toBe(b)
      expect(await dbAccepts(r.design)).toBe(true)
      if (!best || b > designBytes(best)) best = r.design
    }
    expect(await pgBytes(best)).toBeLessThanOrEqual(LIMIT)
    expect(LIMIT - (await pgBytes(best))).toBeGreaterThanOrEqual(1000) // marge de sécurité conservée
  }, 120000)
  it("beaucoup de petites propriétés et de sections : la surcharge « : » / « , » de PostgreSQL est comptée", async () => {
    const many = { sections: Array.from({ length: 30 }, (_, i) => ({ key: i % 2 ? "faq" : "offers", visible: true })), faq: Array.from({ length: 30 }, () => ({ q: "a", a: "b" })), testimonials: Array.from({ length: 30 }, () => ({ name: "a", text: "b", place: "" })), program: Array.from({ length: 30 }, () => ({ title: "a", text: "b" })) }
    const { design, errors } = sanitizeDesign(many, "voyage")
    expect(errors.faq && errors.program && errors.testimonials).toBeTruthy() // listes bornées (8 / 6 / 14) : l'excédent est signalé
    const js = new TextEncoder().encode(JSON.stringify(design)).length
    expect(designBytes(design)).toBe(await pgBytes(design))
    expect(designBytes(design)).toBeGreaterThan(js) // la mesure compacte aurait SOUS-ESTIMÉ
  })
  it("texte coupé au milieu d'un emoji / substituts isolés : nettoyés, JSON valide pour PostgreSQL (sinon « invalid input syntax for type json »)", async () => {
    const r = sanitizeDesign({ cta: { label: "😀".repeat(30) }, faq: [{ q: "a".repeat(139) + "😀", a: "\ud83d seul \ude00" }] }, "hotel")
    expect(r.design.cta.label.length).toBeLessThanOrEqual(40)
    expect(r.design.faq[0].q).toBe("a".repeat(139)) // l'emoji coupé est retiré, jamais envoyé à moitié
    expect(r.design.faq[0].a).toBe("seul")
    expect(await dbAccepts(r.design)).toBe(true)
    // preuve que sans ce nettoyage la base refuserait
    expect(await dbAccepts({ x: JSON.parse('"\\ud83d"') })).toBe(false)
  })
})
