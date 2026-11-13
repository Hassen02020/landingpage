// Commissions nettes importées d'EasyV4 (table landing_commissions, migration 0016). EasyV4 reste la référence financière :
// ici on n'enregistre que ce qui a été IMPORTÉ, toujours « provisoire » jusqu'à confirmation d'un administrateur.
// Aucune connexion à la base d'EasyV4 ; aucune double saisie.
//  • Rapprochement : par la référence du dossier (E2B-XXXXXX) ; à défaut par le téléphone, jamais importé sans VALIDATION manuelle.
//  • Idempotence : réimporter un fichier ne crée aucun doublon (clé unique par entreprise).
//  • Cohérence : une réservation EasyV4 ne peut pas être rattachée à deux dossiers différents.
import { DbError, insertOne, select, update } from "@/lib/server/db"
import { normalizePhone } from "@/lib/server/hash"
import { parseCommissionCsv, type CommissionKind, type ParsedCommissionRow } from "@/lib/commission-import"
import { isMissingTable } from "@/lib/server/ad-spend"

export type MatchStatus = "rapproche" | "a_valider" | "ambigu" | "introuvable" | "deja_importee" | "conflit"
export interface PreviewRow {
  line: number
  lineKey: string
  reservationRef: string
  kind: CommissionKind
  amount: number
  date: string
  status: MatchStatus
  leadRef?: string
  firstName?: string
  warning?: string
}
export interface PreviewResult {
  fatal?: string
  migrationApplied: boolean
  rows: PreviewRow[]
  errors: { line: number; error: string }[]
  counts: Record<MatchStatus, number>
}

interface LeadHit { id: string; ref: string; first_name: string | null; phone: string }
interface ExistingLine { line_key: string; external_ref: string; lead_id: string }

const inList = (values: string[]) => `in.(${encodeURIComponent(values.map((v) => `"${v.replace(/"/g, "")}"`).join(","))})`
const emptyCounts = (): Record<MatchStatus, number> => ({ rapproche: 0, a_valider: 0, ambigu: 0, introuvable: 0, deja_importee: 0, conflit: 0 })

export async function previewCommissionImport(csv: string): Promise<PreviewResult> {
  const parsed = parseCommissionCsv(csv)
  if (parsed.fatal) return { fatal: parsed.fatal, migrationApplied: true, rows: [], errors: [], counts: emptyCounts() }
  const errors = parsed.rows.flatMap((r) => (r.ok ? [] : [{ line: r.line, error: r.error }]))
  const good: ParsedCommissionRow[] = parsed.rows.flatMap((r) => (r.ok ? [r.row] : []))
  const counts = emptyCounts()
  if (!good.length) return { migrationApplied: true, rows: [], errors, counts }

  const refs = Array.from(new Set(good.flatMap((r) => (r.leadRef ? [r.leadRef] : []))))
  const phones = Array.from(new Set(good.flatMap((r) => { const p = !r.leadRef && r.phone ? normalizePhone(r.phone) : null; return p ? [p] : [] })))
  const keys = good.map((r) => r.lineKey)
  const reservations = Array.from(new Set(good.map((r) => r.reservationRef)))

  let existing: ExistingLine[] = []
  let byRef: LeadHit[] = []
  let byPhone: LeadHit[] = []
  try {
    existing = await select<ExistingLine>("landing_commissions", `select=line_key,external_ref,lead_id&or=(line_key.${inList(keys)},external_ref.${inList(reservations)})&limit=2000`)
    if (refs.length) byRef = await select<LeadHit>("landing_leads", `select=id,ref,first_name,phone&ref=${inList(refs)}&limit=1000`)
    if (phones.length) byPhone = await select<LeadHit>("landing_leads", `select=id,ref,first_name,phone&phone=${inList(phones)}&limit=2000`)
  } catch (e) {
    if (isMissingTable(e)) return { migrationApplied: false, rows: [], errors, counts }
    throw e
  }

  const keyExists = new Set(existing.map((e) => e.line_key))
  const reservationLead = new Map<string, string>() // réservation → dossier déjà connu
  existing.forEach((e) => reservationLead.set(e.external_ref, e.lead_id))
  const hasCommission = new Set<string>(good.filter((r) => r.kind === "commission").map((r) => r.reservationRef))
  existing.forEach((e) => { if (e.line_key.includes("|commission|")) hasCommission.add(e.external_ref) })

  const rows: PreviewRow[] = good.map((r) => {
    const base: PreviewRow = { line: r.line, lineKey: r.lineKey, reservationRef: r.reservationRef, kind: r.kind, amount: r.amount, date: r.date, status: "introuvable" }
    if (r.kind !== "commission" && !hasCommission.has(r.reservationRef)) base.warning = "Aucune commission connue pour cette réservation."
    if (keyExists.has(r.lineKey)) return { ...base, status: "deja_importee" }
    let lead: LeadHit | undefined
    let status: MatchStatus = "introuvable"
    if (r.leadRef) {
      lead = byRef.find((l) => l.ref === r.leadRef)
      status = lead ? "rapproche" : "introuvable"
    } else if (r.phone) {
      const p = normalizePhone(r.phone)
      const hits = p ? byPhone.filter((l) => l.phone === p) : []
      if (hits.length === 1) { lead = hits[0]; status = "a_valider" } else if (hits.length > 1) status = "ambigu"
    }
    if (lead) {
      const known = reservationLead.get(r.reservationRef)
      if (known && known !== lead.id) return { ...base, status: "conflit", leadRef: lead.ref }
      reservationLead.set(r.reservationRef, lead.id) // cohérence à l'intérieur du fichier
    }
    return { ...base, status, ...(lead ? { leadRef: lead.ref, firstName: lead.first_name ?? undefined } : {}) }
  })
  rows.forEach((r) => counts[r.status]++)
  return { migrationApplied: true, rows, errors, counts }
}

export interface CommitResult { imported: number; duplicates: number; skipped: number; failed: number; batch: string; message?: string }

/** Importe les lignes rapprochées par référence + celles rapprochées par téléphone que l'administrateur a VALIDÉES (le serveur refait le rapprochement). */
export async function commitCommissionImport(csv: string, validatedKeys: string[], actorId: string | null): Promise<CommitResult> {
  const preview = await previewCommissionImport(csv)
  const batch = `import-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`
  const out: CommitResult = { imported: 0, duplicates: 0, skipped: 0, failed: 0, batch }
  if (preview.fatal) return { ...out, message: preview.fatal }
  if (!preview.migrationApplied) return { ...out, message: "La migration 0016 n'est pas encore appliquée dans Supabase." }
  const validated = new Set(validatedKeys)
  const leadIdByRef = new Map<string, string>()
  const refsNeeded = Array.from(new Set(preview.rows.flatMap((r) => (r.leadRef ? [r.leadRef] : []))))
  if (refsNeeded.length) {
    const hits = await select<{ id: string; ref: string }>("landing_leads", `select=id,ref&ref=${inList(refsNeeded)}&limit=1000`)
    hits.forEach((h) => leadIdByRef.set(h.ref, h.id))
  }
  for (const r of preview.rows) {
    const importable = r.status === "rapproche" || (r.status === "a_valider" && validated.has(r.lineKey))
    if (r.status === "deja_importee") { out.duplicates++; continue }
    if (!importable || !r.leadRef || !leadIdByRef.get(r.leadRef)) { out.skipped++; continue }
    try {
      await insertOne("landing_commissions", {
        lead_id: leadIdByRef.get(r.leadRef), line_key: r.lineKey, external_ref: r.reservationRef, kind: r.kind, amount_tnd: r.amount,
        status: "provisoire", event_date: r.date, source: "import_csv", import_batch: batch, created_by: actorId,
      })
      out.imported++
    } catch (e) {
      if (e instanceof DbError && e.isUniqueViolation) out.duplicates++
      else { out.failed++; console.error("[commissions] ligne non importée", e instanceof Error ? e.message : "erreur") }
    }
  }
  return out
}

export interface CommissionView { id: number; lead_ref: string | null; external_ref: string; kind: CommissionKind; amount_tnd: number | string; status: "provisoire" | "confirme"; event_date: string; import_batch: string | null }

export async function listCommissions(limit = 100): Promise<{ rows: CommissionView[]; migrationApplied: boolean }> {
  try {
    const rows = await select<{ id: number; lead_id: string; external_ref: string; kind: CommissionKind; amount_tnd: number | string; status: "provisoire" | "confirme"; event_date: string; import_batch: string | null }>(
      "landing_commissions", `select=id,lead_id,external_ref,kind,amount_tnd,status,event_date,import_batch&order=created_at.desc,id.desc&limit=${Math.min(limit, 500)}`)
    const ids = Array.from(new Set(rows.map((r) => r.lead_id)))
    const refs = new Map<string, string>()
    if (ids.length) (await select<{ id: string; ref: string }>("landing_leads", `select=id,ref&id=${inList(ids)}&limit=500`)).forEach((l) => refs.set(l.id, l.ref))
    return { rows: rows.map((r) => ({ id: r.id, lead_ref: refs.get(r.lead_id) ?? null, external_ref: r.external_ref, kind: r.kind, amount_tnd: r.amount_tnd, status: r.status, event_date: r.event_date, import_batch: r.import_batch })), migrationApplied: true }
  } catch (e) {
    if (isMissingTable(e)) return { rows: [], migrationApplied: false }
    console.error("[commissions] lecture impossible", e instanceof Error ? e.message : "erreur")
    return { rows: [], migrationApplied: true }
  }
}

/** Confirme des commissions (provisoire → confirmé, une seule fois). Le déclencheur de la base refuse toute autre modification. */
export async function confirmCommissions(ids: number[], actorId: string | null): Promise<{ confirmed: number; failed: number }> {
  let confirmed = 0, failed = 0
  for (const id of Array.from(new Set(ids)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)) {
    try {
      const done = await update<{ id: number }>("landing_commissions", `id=eq.${id}&status=eq.provisoire`, { status: "confirme", confirmed_at: new Date().toISOString(), confirmed_by: actorId })
      if (done.length) confirmed++
    } catch (e) {
      failed++
      console.error("[commissions] confirmation impossible", e instanceof Error ? e.message : "erreur")
    }
  }
  return { confirmed, failed }
}
