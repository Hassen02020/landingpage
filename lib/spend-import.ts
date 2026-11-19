// Import contrôlé des dépenses publicitaires depuis un export CSV d'Ads Manager (Meta). Analyse PURE : aucune base, aucun appel réseau.
// Principes : rien n'est écrit sans aperçu et validation ; jamais de taux de change inventé (devise autre que TND => taux saisi par le
// propriétaire, affiché dans l'aperçu) ; noms de campagne hors convention refusés comme à la saisie manuelle ; relance sans doublon.
import { isConventionalCampaign } from "@/lib/campaign-name"
import { parseDate } from "@/lib/commission-import"

export const MAX_SPEND_ROWS = 500
export const MAX_SPEND_BYTES = 200_000

export interface ParsedSpendRow {
  line: number
  date: string
  campaign: string
  /** montant d'origine dans la devise de l'export */
  original: number
  /** montant converti en TND (arrondi au millime) */
  amountTnd: number
  /** référence unique : une même ligne ne s'importe qu'une fois */
  reference: string
}
export type SpendLine = { ok: true; row: ParsedSpendRow } | { ok: false; line: number; error: string }
export interface SpendParse { lines: SpendLine[]; currency: string | null; needsRate: boolean; fatal?: string }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

const DATE_KEYS = ["jour", "day", "date", "debut_des_rapports", "reporting_starts"]
const CAMPAIGN_KEYS = ["nom_de_la_campagne", "campaign_name", "campagne", "campaign"]

/** Montant d'un export : « 12,34 », « 1 234.50 », « 12.5 » ; renvoie null si vide, non numérique ou négatif. 0 est valide (ligne ignorée plus loin). */
export function parseSpendAmount(v: string): number | null {
  const t = v.replace(/\s/g, "").replace(/[^\d,.]/g, "")
  if (!t) return null
  const lc = t.lastIndexOf(","), ld = t.lastIndexOf(".")
  const dec = Math.max(lc, ld)
  const norm = dec >= 0 ? t.slice(0, dec).replace(/[,.]/g, "") + "." + t.slice(dec + 1) : t
  const n = parseFloat(norm)
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = "", q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === delim && !q) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** `rate` : combien de TND vaut 1 unité de la devise de l'export (obligatoire si la devise n'est pas TND). */
export function parseSpendCsv(text: string, rate?: number): SpendParse {
  const none = { lines: [], currency: null, needsRate: false }
  if (text.length > MAX_SPEND_BYTES) return { ...none, fatal: "Fichier trop volumineux (200 Ko maximum)." }
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "")
  if (lines.length < 2) return { ...none, fatal: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données." }
  if (lines.length - 1 > MAX_SPEND_ROWS) return { ...none, fatal: `Trop de lignes (${MAX_SPEND_ROWS} maximum par import).` }
  const delim = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ";" : ","
  const rawHeader = splitLine(lines[0], delim)
  const keys = rawHeader.map((h) => strip(h))
  const iDate = keys.findIndex((k) => DATE_KEYS.includes(k))
  const iCamp = keys.findIndex((k) => CAMPAIGN_KEYS.includes(k))
  const iAmount = keys.findIndex((k) => k.startsWith("montant_depense") || k.startsWith("amount_spent") || k === "montant_tnd" || k === "amount_tnd")
  if (iDate < 0) return { ...none, fatal: "Colonne de date absente (« Jour » ou « Day »)." }
  if (iCamp < 0) return { ...none, fatal: "Colonne de campagne absente (« Nom de la campagne » ou « Campaign name »)." }
  if (iAmount < 0) return { ...none, fatal: "Colonne de montant absente (« Montant dépensé (USD) » ou « Amount spent (USD) »)." }
  // devise : lue dans l'en-tête du montant, entre parenthèses (« Montant dépensé (USD) ») ; « montant_tnd » = TND
  const cur = /\(([A-Za-z]{3})\)/.exec(rawHeader[iAmount])?.[1]?.toUpperCase() ?? (keys[iAmount].endsWith("_tnd") ? "TND" : null)
  if (!cur) return { ...none, fatal: "Devise introuvable dans l'en-tête du montant (attendu : « Montant dépensé (USD) » ou « montant_tnd »)." }
  const needsRate = cur !== "TND"
  if (needsRate && !(typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate < 1000)) {
    return { lines: [], currency: cur, needsRate: true }
  }
  const factor = needsRate ? (rate as number) : 1
  const seen = new Set<string>()
  const out: SpendLine[] = []
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2
    const cells = splitLine(raw, delim)
    const date = parseDate(cells[iDate] ?? "")
    if (!date) return out.push({ ok: false, line, error: "Date invalide (AAAA-MM-JJ ou JJ/MM/AAAA)." })
    const campaign = (cells[iCamp] ?? "").trim().replace(/\s+/g, " ")
    if (!campaign) return out.push({ ok: false, line, error: "Nom de campagne absent." })
    if (!isConventionalCampaign(campaign)) return out.push({ ok: false, line, error: `Nom de campagne hors convention : « ${campaign.slice(0, 60)} » (minuscules, chiffres et tirets).` })
    const original = parseSpendAmount(cells[iAmount] ?? "")
    if (original === null) return out.push({ ok: false, line, error: "Montant invalide." })
    if (original === 0) return out.push({ ok: false, line, error: "Montant nul : ligne ignorée." })
    const amountTnd = Math.round(original * factor * 1000) / 1000
    if (amountTnd <= 0) return out.push({ ok: false, line, error: "Montant converti nul." })
    const reference = `import-meta:${date}:${campaign.toLowerCase()}`
    if (seen.has(reference)) return out.push({ ok: false, line, error: "Ligne en double dans le fichier (même jour, même campagne)." })
    seen.add(reference)
    out.push({ ok: true, row: { line, date, campaign, original, amountTnd, reference } })
  })
  return { lines: out, currency: cur, needsRate: false }
}
