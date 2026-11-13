// Import contrôlé des commissions nettes d'EasyV4 (référence financière). Analyse PURE d'un fichier CSV : aucune base,
// aucune connexion à EasyV4. Colonnes reconnues (noms insensibles à la casse et aux accents) :
//   reservation_ref  (obligatoire) référence de la réservation chez EasyV4
//   nature           (obligatoire) commission | annulation | remboursement
//   montant_tnd      (obligatoire) montant en dinars (le signe du fichier est ignoré : la nature décide du signe)
//   date             (obligatoire) AAAA-MM-JJ ou JJ/MM/AAAA
//   lead_ref         (recommandée) référence Landing E2B-XXXXXX du dossier
//   telephone        (à défaut de lead_ref) rapprochement à VALIDER à la main
//   ligne            (facultative) numéro pour plusieurs lignes de même nature (ex. deux remboursements partiels)
export type CommissionKind = "commission" | "annulation" | "remboursement"
export const MAX_IMPORT_ROWS = 500
export const MAX_IMPORT_BYTES = 200_000
export const LEAD_REF = /^E2B-[A-Z0-9]{6}$/

export interface ParsedCommissionRow {
  line: number
  reservationRef: string
  kind: CommissionKind
  /** montant signé en TND (commission > 0 ; annulation / remboursement < 0) */
  amount: number
  date: string
  leadRef: string | null
  phone: string | null
  lineKey: string
}
export type ParsedRow = { ok: true; row: ParsedCommissionRow } | { ok: false; line: number; error: string }
export interface ParseResult { rows: ParsedRow[]; fatal?: string }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
const ALIASES: Record<string, string> = {
  reservation_ref: "reservation_ref", reservation: "reservation_ref", ref_reservation: "reservation_ref", reference_reservation: "reservation_ref",
  nature: "nature", type: "nature",
  montant_tnd: "montant", montant: "montant", commission_nette: "montant", commission: "montant",
  date: "date", date_evenement: "date",
  lead_ref: "lead_ref", ref_lead: "lead_ref", reference_lead: "lead_ref", reference: "lead_ref",
  telephone: "telephone", tel: "telephone", phone: "telephone",
  ligne: "ligne", n: "ligne", numero: "ligne",
}

function splitLine(line: string, d: string): string[] {
  const out: string[] = []
  let cur = ""
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === d) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

export function parseKind(v: string): CommissionKind | null {
  const k = strip(v)
  if (["commission", "commission_nette", "vente"].includes(k)) return "commission"
  if (["annulation", "annule", "annulee", "annulation_reservation"].includes(k)) return "annulation"
  if (["remboursement", "rembourse", "remboursee", "refund"].includes(k)) return "remboursement"
  return null
}

export function parseAmount(v: string): number | null {
  const t = v.replace(/\s/g, "").replace(/[^\d,.\-]/g, "")
  if (!t) return null
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".")
  const dec = Math.max(lastComma, lastDot)
  let norm = t
  if (dec >= 0) norm = t.slice(0, dec).replace(/[,.]/g, "") + "." + t.slice(dec + 1)
  const n = Math.abs(parseFloat(norm))
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null
  return Math.round(n * 1000) / 1000
}

export function parseDate(v: string): string | null {
  const t = v.trim()
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else if (fr) { y = +fr[3]; m = +fr[2]; d = +fr[1] }
  else return null
  if (y < 2020 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function parseCommissionCsv(text: string): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return { rows: [], fatal: "Fichier trop volumineux (200 Ko maximum)." }
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "")
  if (lines.length < 2) return { rows: [], fatal: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données." }
  if (lines.length - 1 > MAX_IMPORT_ROWS) return { rows: [], fatal: `Trop de lignes (${MAX_IMPORT_ROWS} maximum par import).` }
  const delim = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ";" : ","
  const header = splitLine(lines[0], delim).map((h) => ALIASES[strip(h)] ?? "")
  for (const need of ["reservation_ref", "nature", "montant", "date"]) {
    if (!header.includes(need)) return { rows: [], fatal: `Colonne obligatoire absente : ${need === "montant" ? "montant_tnd" : need}.` }
  }
  const seen = new Set<string>()
  const rows: ParsedRow[] = []
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2
    const cells = splitLine(raw, delim)
    const get = (k: string) => (cells[header.indexOf(k)] ?? "").trim()
    const reservationRef = get("reservation_ref")
    if (!/^[A-Za-z0-9][A-Za-z0-9_.\-\/ ]{0,99}$/.test(reservationRef)) return rows.push({ ok: false, line, error: "Référence de réservation absente ou invalide." })
    const kind = parseKind(get("nature"))
    if (!kind) return rows.push({ ok: false, line, error: "Nature inconnue (commission, annulation ou remboursement)." })
    const abs = parseAmount(get("montant"))
    if (abs === null) return rows.push({ ok: false, line, error: "Montant invalide ou nul." })
    const date = parseDate(get("date"))
    if (!date) return rows.push({ ok: false, line, error: "Date invalide (AAAA-MM-JJ ou JJ/MM/AAAA)." })
    const rawLead = get("lead_ref").toUpperCase()
    if (rawLead && !LEAD_REF.test(rawLead)) return rows.push({ ok: false, line, error: "Référence de dossier invalide (attendu : E2B-XXXXXX)." })
    const phone = get("telephone").replace(/[^\d+]/g, "") || null
    if (!rawLead && !phone) return rows.push({ ok: false, line, error: "Ni référence de dossier (lead_ref) ni téléphone : rapprochement impossible." })
    const seq = get("ligne") && /^\d{1,3}$/.test(get("ligne")) ? get("ligne") : "1"
    const lineKey = `${reservationRef.replace(/\s+/g, " ")}|${kind}|${seq}`
    if (seen.has(lineKey)) return rows.push({ ok: false, line, error: "Ligne en double dans le fichier (même réservation, même nature, même numéro)." })
    seen.add(lineKey)
    rows.push({ ok: true, row: { line, reservationRef: reservationRef.replace(/\s+/g, " "), kind, amount: kind === "commission" ? abs : -abs, date, leadRef: rawLead || null, phone, lineKey } })
  })
  return { rows }
}
