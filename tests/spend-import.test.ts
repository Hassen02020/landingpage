// Import des dépenses Meta (CSV) et motif de perte obligatoire. Jeux de données FICTIFS, aucune base, aucun réseau.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseSpendAmount, parseSpendCsv } from "@/lib/spend-import"
import { lossReasonError } from "@/lib/governance"

let existing: Record<string, unknown>[] = []
const inserted: Record<string, unknown>[] = []
vi.mock("@/lib/server/db", () => ({
  select: vi.fn(async () => existing),
  insertOne: vi.fn(async (_t: string, row: Record<string, unknown>) => { inserted.push(row); return row }),
  DbError: class DbError extends Error { code = "x" },
}))
vi.mock("@/lib/server/crm", () => ({ tunisDay: () => "2026-11-19" }))
vi.mock("@/lib/server/ad-spend", () => ({ isMissingTable: () => false }))
import { commitSpendImport, previewSpendImport } from "@/lib/server/spend-import"

const USD = "Jour;Nom de la campagne;Montant dépensé (USD)\n2026-11-17;omra-ramadan-2027-fb;1,50\n2026-11-18;omra-ramadan-2027-fb;2.25\n"
const TND = "Jour,Nom de la campagne,montant_tnd\n17/11/2026,omra-ramadan-2027-fb,10\n"

describe("analyse du CSV de dépenses", () => {
  it("lit les montants à la française, à l'anglaise et refuse le reste", () => {
    expect(parseSpendAmount("1,50")).toBe(1.5)
    expect(parseSpendAmount("1 234.50")).toBe(1234.5)
    expect(parseSpendAmount("0")).toBe(0)
    expect(parseSpendAmount("")).toBeNull()
    expect(parseSpendAmount("abc")).toBeNull()
  })

  it("devise autre que TND : taux requis, jamais deviné", () => {
    const p = parseSpendCsv(USD)
    expect(p.needsRate).toBe(true)
    expect(p.currency).toBe("USD")
    expect(p.lines).toEqual([])
    expect(parseSpendCsv(USD, 0).needsRate).toBe(true)
    expect(parseSpendCsv(USD, -3).needsRate).toBe(true)
  })

  it("convertit avec le taux saisi, arrondi au millime", () => {
    const p = parseSpendCsv(USD, 3.1)
    const rows = p.lines.flatMap((l) => (l.ok ? [l.row] : []))
    expect(rows.map((r) => r.amountTnd)).toEqual([4.65, 6.975])
    expect(rows[0].reference).toBe("import-meta:2026-11-17:omra-ramadan-2027-fb")
  })

  it("montants déjà en TND : aucun taux demandé, dates JJ/MM/AAAA acceptées", () => {
    const p = parseSpendCsv(TND)
    expect(p.needsRate).toBe(false)
    expect(p.lines[0]).toMatchObject({ ok: true, row: { date: "2026-11-17", amountTnd: 10 } })
  })

  it("refuse nom hors convention, date invalide, montant nul et doublon dans le fichier", () => {
    const csv = "Jour;Nom de la campagne;montant_tnd\n2026-11-17;Omra Ramadan;5\n2026-13-40;omra-a;5\n2026-11-17;omra-b;0\n2026-11-17;omra-c;5\n2026-11-17;omra-c;6\n"
    const errs = parseSpendCsv(csv).lines.flatMap((l) => (l.ok ? [] : [l.error]))
    expect(errs[0]).toMatch(/hors convention/)
    expect(errs[1]).toMatch(/Date invalide/)
    expect(errs[2]).toMatch(/nul/)
    expect(errs[3]).toMatch(/double/)
  })

  it("en-tête incomplet ou fichier vide : erreur claire, aucune ligne", () => {
    expect(parseSpendCsv("Jour;Montant (USD)\n2026-11-17;1").fatal).toMatch(/campagne/)
    expect(parseSpendCsv("Jour;Nom de la campagne;Montant\n2026-11-17;a;1").fatal).toMatch(/montant/i)
    expect(parseSpendCsv("Jour;Nom de la campagne;Montant dépensé\n2026-11-17;omra-a;1").fatal).toMatch(/Devise/)
    expect(parseSpendCsv("seulement un en-tête").fatal).toMatch(/au moins une ligne/)
  })
})

describe("aperçu et écriture de l'import", () => {
  beforeEach(() => { existing = []; inserted.length = 0 })

  it("sépare nouvelle, déjà importée et conflit ; une ligne identique n'est jamais doublée", async () => {
    existing = [
      { id: 1, reference: "import-meta:2026-11-17:omra-ramadan-2027-fb", amount_tnd: "4.650", voids_id: null },
      { id: 2, reference: "import-meta:2026-11-18:omra-ramadan-2027-fb", amount_tnd: "9.000", voids_id: null },
    ]
    const p = await previewSpendImport(USD, 3.1)
    expect(p.rows.map((r) => r.status)).toEqual(["deja_importee", "conflit"])
    expect(p.counts).toEqual({ nouvelle: 0, deja_importee: 1, conflit: 1 })
    const res = await commitSpendImport(USD, 3.1, "u1")
    expect(res.imported).toBe(0)
    expect(inserted).toEqual([])
  })

  it("une dépense annulée peut être ré-importée", async () => {
    existing = [
      { id: 1, reference: "import-meta:2026-11-17:omra-ramadan-2027-fb", amount_tnd: "4.650", voids_id: null },
      { id: 3, reference: "import-meta:2026-11-17:omra-ramadan-2027-fb", amount_tnd: "-4.650", voids_id: 1 },
    ]
    const res = await commitSpendImport("Jour;Nom de la campagne;montant_tnd\n2026-11-17;omra-ramadan-2027-fb;4,65\n", undefined, "u1")
    expect(res.imported).toBe(1)
    expect(inserted[0]).toMatchObject({ spend_date: "2026-11-17", network: "meta", campaign: "omra-ramadan-2027-fb", amount_tnd: 4.65, source: "manuel", created_by: "u1" })
  })

  it("écrit seulement les lignes nouvelles, réseau Meta, sans taux manquant ; date future refusée", async () => {
    const withFuture = USD + "2027-01-01;omra-ramadan-2027-fb;1\n"
    const p = await previewSpendImport(withFuture, 3.1)
    expect(p.errors.some((e) => /futur/.test(e.error))).toBe(true)
    expect(p.totalNewTnd).toBe(11.625)
    const res = await commitSpendImport(withFuture, 3.1, null)
    expect(res.imported).toBe(2)
    expect(inserted.every((r) => r.network === "meta")).toBe(true)
    const noRate = await commitSpendImport(USD, undefined, null)
    expect(noRate.fatal).toMatch(/Taux de change/)
  })
})

describe("motif de perte obligatoire", () => {
  it("exigé pour « perdu », valide ou déjà enregistré", () => {
    expect(lossReasonError("perdu", null, null)).toMatch(/motif/i)
    expect(lossReasonError("perdu", "", undefined)).toMatch(/motif/i)
    expect(lossReasonError("perdu", "prix", null)).toBeNull()
    expect(lossReasonError("perdu", "parce que", null)).toMatch(/invalide/)
    expect(lossReasonError("perdu", null, "injoignable")).toBeNull()
  })
  it("n'impose rien aux autres statuts", () => {
    expect(lossReasonError("qualifie", null, null)).toBeNull()
    expect(lossReasonError("reserve", null, null)).toBeNull()
  })
})
