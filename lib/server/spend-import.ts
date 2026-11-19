// Import des dépenses Meta (CSV d'Ads Manager) : aperçu puis écriture. Registre à AJOUT SEUL (comme la saisie manuelle).
// Cloisonné par l'entreprise de la requête ; aucune écriture sans aperçu validé ; une ligne déjà importée n'est jamais doublée,
// et une ligne dont le montant a changé est refusée (annuler l'ancienne dépense, puis ré-importer).
import { DbError, insertOne, select } from "@/lib/server/db"
import { tunisDay } from "@/lib/server/crm"
import { isMissingTable } from "@/lib/server/ad-spend"
import { parseSpendCsv, type ParsedSpendRow } from "@/lib/spend-import"

export type SpendImportStatus = "nouvelle" | "deja_importee" | "conflit"
export interface SpendPreviewRow extends ParsedSpendRow { status: SpendImportStatus; existingTnd?: number }
export interface SpendPreview {
  currency: string | null
  needsRate: boolean
  rows: SpendPreviewRow[]
  errors: { line: number; error: string }[]
  counts: Record<SpendImportStatus, number>
  totalNewTnd: number
  fatal?: string
}
export interface SpendCommit { imported: number; skipped: number; failed: number; message?: string }

const nextDay = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const empty = (extra: Partial<SpendPreview> = {}): SpendPreview => ({ currency: null, needsRate: false, rows: [], errors: [], counts: { nouvelle: 0, deja_importee: 0, conflit: 0 }, totalNewTnd: 0, ...extra })

interface Existing { id: number; reference: string | null; amount_tnd: number | string; voids_id: number | null }

export async function previewSpendImport(csv: string, rate?: number): Promise<SpendPreview> {
  const parsed = parseSpendCsv(csv, rate)
  if (parsed.fatal) return empty({ fatal: parsed.fatal })
  if (parsed.needsRate) return empty({ currency: parsed.currency, needsRate: true })
  const ok = parsed.lines.flatMap((l) => (l.ok ? [l.row] : []))
  const errors = parsed.lines.flatMap((l) => (l.ok ? [] : [{ line: l.line, error: l.error }]))
  const today = nextDay(tunisDay())
  let existing: Existing[] = []
  try {
    existing = await select<Existing>("landing_ad_spend", "select=id,reference,amount_tnd,voids_id&reference=like.import-meta%3A*&limit=10000")
  } catch (e) {
    if (isMissingTable(e)) return empty({ fatal: "La migration 0016 n'est pas encore appliquée dans Supabase." })
    throw e
  }
  const voided = new Set(existing.filter((e) => e.voids_id != null).map((e) => e.voids_id))
  const live = new Map<string, Existing>()
  for (const e of existing) if (e.voids_id == null && !voided.has(e.id) && e.reference) live.set(e.reference, e)
  const counts = { nouvelle: 0, deja_importee: 0, conflit: 0 }
  let totalNewTnd = 0
  const rows: SpendPreviewRow[] = []
  for (const r of ok) {
    if (r.date > today) { errors.push({ line: r.line, error: "La date ne peut pas être dans le futur." }); continue }
    const e = live.get(r.reference)
    let status: SpendImportStatus = "nouvelle"
    let existingTnd: number | undefined
    if (e) {
      existingTnd = Number(e.amount_tnd)
      status = Math.abs(existingTnd - r.amountTnd) < 0.0005 ? "deja_importee" : "conflit"
    }
    counts[status]++
    if (status === "nouvelle") totalNewTnd += r.amountTnd
    rows.push({ ...r, status, existingTnd })
  }
  errors.sort((a, b) => a.line - b.line)
  return { currency: parsed.currency, needsRate: false, rows, errors, counts, totalNewTnd: Math.round(totalNewTnd * 1000) / 1000 }
}

/** N'écrit que les lignes « nouvelle » ; recalcule tout côté serveur (le client ne décide de rien). */
export async function commitSpendImport(csv: string, rate: number | undefined, actorId: string | null): Promise<SpendCommit & { fatal?: string }> {
  const p = await previewSpendImport(csv, rate)
  if (p.fatal) return { imported: 0, skipped: 0, failed: 0, fatal: p.fatal }
  if (p.needsRate) return { imported: 0, skipped: 0, failed: 0, fatal: "Taux de change requis (1 unité de la devise de l'export = combien de TND)." }
  let imported = 0, failed = 0
  for (const r of p.rows) {
    if (r.status !== "nouvelle") continue
    try {
      await insertOne("landing_ad_spend", { spend_date: r.date, network: "meta", campaign: r.campaign, amount_tnd: r.amountTnd, reference: r.reference, source: "manuel", created_by: actorId })
      imported++
    } catch (e) {
      failed++
      console.error("[spend-import] écriture impossible", e instanceof DbError ? e.code : "erreur")
    }
  }
  return { imported, skipped: p.rows.length - imported - failed + p.errors.length, failed }
}
