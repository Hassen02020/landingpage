// Rentabilité publicitaire : calcul PUR (testable, sans base) à partir de
//  • leads + historique des statuts (Landing),
//  • dépenses publicitaires saisies (landing_ad_spend : manuel aujourd'hui, API demain),
//  • registre de commissions nettes importées d'EasyV4 (landing_commissions), provisoires ou confirmées.
// EasyV4 reste la référence financière : ici on ne fait que LIRE ce qui a été importé, rien n'est inventé ni saisi en double.
//
// Règles :
//  • Résultat = commission nette − dépenses ; rentabilité = commission nette ÷ dépenses × 100 ; dépenses nulles → « non calculable » (null), jamais 0 %.
//  • Étapes CUMULATIVES par dossier (une seule fois chacune) : qualifié = a atteint « qualifié » ou plus loin (même s'il est perdu ensuite) ;
//    devis = a atteint « devis » ou plus loin. Réservation = dossier ACTUELLEMENT réservé ou gagné (une annulation le retire).
//  • Commission nette d'un dossier = somme de ses lignes (commission + annulations/remboursements négatifs) ; provisoire et confirmé séparés.
//  • Les montants sont calculés en millimes (entiers) : aucune erreur d'arrondi flottant.
//  • Dépenses ↔ leads : par réseau + nom de campagne normalisé. Une dépense dont la campagne n'a aucun lead est listée « non rattachée ».
//  • Pour les dimensions produit / niche / annonce, la dépense d'une campagne est RÉPARTIE au prorata de ses leads : exacte si la campagne n'a qu'un groupe, sinon marquée « estimée ».
import { maxRank, type FunnelActivity } from "@/lib/server/analytics"
import { STATUSES, isBooking, type Status } from "@/lib/status"

export type Network = "meta" | "tiktok" | "autre"
export type Dimension = "network" | "campaign" | "product" | "niche" | "ad"

export interface EconLead {
  id: string
  created_at: string
  status: Status
  booking_value: number | string | null
  booked_at: string | null
  channel: string | null
  utm_campaign: string | null
  utm_content?: string | null
  ad_id?: string | null
  product: string | null
  niche: string | null
}
export interface SpendRow { id?: number; spend_date: string; network: "meta" | "tiktok"; campaign: string; amount_tnd: number | string; voids_id?: number | null }
export interface CommissionRow { lead_id: string; kind: "commission" | "annulation" | "remboursement"; amount_tnd: number | string; status: "provisoire" | "confirme" }

export interface Metrics {
  spend: number
  leads: number
  qualified: number
  quotes: number
  bookings: number
  commissionConfirmed: number
  commissionProvisional: number
  commissionNet: number
  result: number
  /** null : dépenses nulles → rentabilité non calculable (jamais 0 %) */
  profitabilityPct: number | null
  cpl: number | null
  costPerQualified: number | null
  costPerQuote: number | null
  costPerBooking: number | null
  qualificationRate: number | null
  quoteRate: number | null
  bookingRate: number | null
}

export type SpendBasis = "exacte" | "estimee" | "aucune"
export interface GroupRow {
  key: string
  label: string
  metrics: Metrics
  spendBasis: SpendBasis
  /** assez de réservations pour comparer sérieusement (seuil minBookings) */
  sufficient: boolean
  /** une partie de la commission nette n'est pas encore confirmée */
  hasProvisional: boolean
}
export interface UnattachedSpend { network: "meta" | "tiktok"; campaign: string; amount: number }
export interface EconomicsResult {
  rows: GroupRow[]
  total: GroupRow
  unattachedSpend: UnattachedSpend[]
  /** meilleure ligne : résultat positif, dépenses > 0, échantillon suffisant ; null sinon (raison dans winnerReason) */
  winnerKey: string | null
  winnerReason: string
}
export interface EconomicsInput {
  leads: EconLead[]
  activities: FunnelActivity[]
  spends: SpendRow[]
  commissions: CommissionRow[]
  /** nombre minimal de réservations pour désigner une gagnante (défaut 5) */
  minBookings?: number
}

const RANK_QUALIFIED = STATUSES.indexOf("qualifie")
const RANK_QUOTE = STATUSES.indexOf("devis")

/** Nom de campagne normalisé (identique à la colonne `campaign_key` de la base). */
export const normalizeCampaign = (s: string | null | undefined): string => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase()

export function leadNetwork(channel: string | null | undefined): Network {
  const c = String(channel ?? "").toLowerCase()
  return c === "meta" || c === "tiktok" ? c : "autre"
}

const toMilli = (v: number | string | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Number.isFinite(n) ? Math.round(n * 1000) : 0
}
const tnd = (m: number): number => Math.round(m) / 1000
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null)
const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((1000 * a) / b) / 10 : null)

interface Acc { spend: number; leads: number; qualified: number; quotes: number; bookings: number; comConfirmed: number; comProvisional: number }
const empty = (): Acc => ({ spend: 0, leads: 0, qualified: 0, quotes: 0, bookings: 0, comConfirmed: 0, comProvisional: 0 })

function metrics(a: Acc): Metrics {
  const net = a.comConfirmed + a.comProvisional
  // sans dépense enregistrée, un coût unitaire n'est pas « 0 » : il est non calculable (null)
  const perUnit = (n: number) => { const x = a.spend > 0 ? div(a.spend, n) : null; return x === null ? null : Math.round(x) / 1000 }
  return {
    spend: tnd(a.spend), leads: a.leads, qualified: a.qualified, quotes: a.quotes, bookings: a.bookings,
    commissionConfirmed: tnd(a.comConfirmed), commissionProvisional: tnd(a.comProvisional), commissionNet: tnd(net),
    result: tnd(net - a.spend),
    profitabilityPct: a.spend > 0 ? Math.round((1000 * net) / a.spend) / 10 : null,
    cpl: perUnit(a.leads), costPerQualified: perUnit(a.qualified), costPerQuote: perUnit(a.quotes), costPerBooking: perUnit(a.bookings),
    qualificationRate: pct(a.qualified, a.leads), quoteRate: pct(a.quotes, a.leads), bookingRate: pct(a.bookings, a.leads),
  }
}

interface LeadFacts { lead: EconLead; qualified: boolean; quote: boolean; booked: boolean; comConfirmed: number; comProvisional: number; net: Network; campKey: string }

function groupKeyOf(f: LeadFacts, dim: Dimension): { key: string; label: string } {
  const l = f.lead
  switch (dim) {
    case "network": return { key: f.net, label: f.net === "meta" ? "Meta" : f.net === "tiktok" ? "TikTok" : "Autres canaux" }
    case "campaign": { const k = `${f.net}|${f.campKey || "(aucune)"}`; return { key: k, label: `${f.net === "meta" ? "Meta" : f.net === "tiktok" ? "TikTok" : "Autre"} · ${l.utm_campaign?.trim() || "(aucune)"}` } }
    case "product": return { key: l.product || "(inconnu)", label: l.product || "(inconnu)" }
    case "niche": return { key: l.niche || "(général)", label: l.niche || "(général)" }
    case "ad": { const a = l.ad_id || l.utm_content || "(inconnue)"; return { key: String(a), label: String(a) } }
  }
}

export function economics(input: EconomicsInput, dim: Dimension): EconomicsResult {
  const minBookings = input.minBookings ?? 5
  const actsByLead = new Map<string, FunnelActivity[]>()
  for (const a of input.activities) (actsByLead.get(a.lead_id) ?? actsByLead.set(a.lead_id, []).get(a.lead_id)!).push(a)

  // commissions par dossier (provisoire / confirmé séparés), annulations et remboursements déjà négatifs
  const com = new Map<string, { c: number; p: number }>()
  for (const r of input.commissions) {
    const e = com.get(r.lead_id) ?? { c: 0, p: 0 }
    if (r.status === "confirme") e.c += toMilli(r.amount_tnd)
    else e.p += toMilli(r.amount_tnd)
    com.set(r.lead_id, e)
  }

  const facts: LeadFacts[] = input.leads.map((lead) => {
    const rank = maxRank({ id: lead.id, created_at: lead.created_at, status: lead.status, booking_value: lead.booking_value, booked_at: lead.booked_at }, actsByLead.get(lead.id) ?? [])
    const c = com.get(lead.id)
    return {
      lead, qualified: rank >= RANK_QUALIFIED, quote: rank >= RANK_QUOTE, booked: isBooking(lead.status),
      comConfirmed: c?.c ?? 0, comProvisional: c?.p ?? 0, net: leadNetwork(lead.channel), campKey: normalizeCampaign(lead.utm_campaign),
    }
  })

  // dépenses effectives (annulations incluses) par réseau + campagne normalisée
  const spendBy = new Map<string, { network: "meta" | "tiktok"; campaign: string; milli: number }>()
  for (const s of input.spends) {
    const k = `${s.network}|${normalizeCampaign(s.campaign)}`
    const e = spendBy.get(k) ?? { network: s.network, campaign: s.campaign.trim(), milli: 0 }
    e.milli += toMilli(s.amount_tnd)
    spendBy.set(k, e)
  }

  const groups = new Map<string, { label: string; acc: Acc; basis: SpendBasis }>()
  const group = (key: string, label: string) => groups.get(key) ?? groups.set(key, { label, acc: empty(), basis: "aucune" }).get(key)!
  const total = empty()

  // chaque campagne : ses leads par groupe (pour répartir la dépense)
  const campGroups = new Map<string, Map<string, number>>()
  for (const f of facts) {
    const g = groupKeyOf(f, dim)
    const grp = group(g.key, g.label)
    grp.acc.leads++; total.leads++
    if (f.qualified) { grp.acc.qualified++; total.qualified++ }
    if (f.quote) { grp.acc.quotes++; total.quotes++ }
    if (f.booked) { grp.acc.bookings++; total.bookings++ }
    grp.acc.comConfirmed += f.comConfirmed; grp.acc.comProvisional += f.comProvisional
    total.comConfirmed += f.comConfirmed; total.comProvisional += f.comProvisional
    const ck = `${f.net}|${f.campKey}`
    const m = campGroups.get(ck) ?? campGroups.set(ck, new Map()).get(ck)!
    m.set(g.key, (m.get(g.key) ?? 0) + 1)
  }

  const unattached: UnattachedSpend[] = []
  for (const [ck, s] of Array.from(spendBy.entries())) {
    total.spend += s.milli
    const leadsOfCampaign = campGroups.get(ck)
    if (!leadsOfCampaign || leadsOfCampaign.size === 0) {
      // aucune lead sur cette campagne : pour les dimensions réseau / campagne la ligne existe quand même (coût sans prospect)
      if (dim === "network") { const g = group(s.network, s.network === "meta" ? "Meta" : "TikTok"); g.acc.spend += s.milli; g.basis = "exacte" }
      else if (dim === "campaign") { const g = group(ck, `${s.network === "meta" ? "Meta" : "TikTok"} · ${s.campaign}`); g.acc.spend += s.milli; g.basis = "exacte" }
      if (s.milli !== 0) unattached.push({ network: s.network, campaign: s.campaign, amount: tnd(s.milli) })
      continue
    }
    if (dim === "network") { const g = group(s.network, s.network === "meta" ? "Meta" : "TikTok"); g.acc.spend += s.milli; g.basis = "exacte"; continue }
    if (dim === "campaign") { const g = groups.get(ck)!; g.acc.spend += s.milli; g.basis = "exacte"; continue }
    // produit / niche / annonce : répartition au prorata des leads de la campagne (restes d'arrondi attribués au plus gros groupe)
    const totalLeads = Array.from(leadsOfCampaign.values()).reduce((a, b) => a + b, 0)
    const entries = Array.from(leadsOfCampaign.entries()).sort((a, b) => b[1] - a[1])
    let given = 0
    entries.forEach(([gk, n], i) => {
      const part = i === entries.length - 1 ? s.milli - given : Math.round((s.milli * n) / totalLeads)
      given += part
      const g = groups.get(gk)!
      g.acc.spend += part
      g.basis = entries.length === 1 && g.basis !== "estimee" ? "exacte" : "estimee"
    })
  }

  const rows: GroupRow[] = Array.from(groups.entries()).map(([key, g]) => {
    const m = metrics(g.acc)
    return { key, label: g.label, metrics: m, spendBasis: g.acc.spend > 0 ? g.basis : "aucune", sufficient: m.bookings >= minBookings, hasProvisional: g.acc.comProvisional !== 0 }
  })
  rows.sort((a, b) => b.metrics.result - a.metrics.result || b.metrics.bookings - a.metrics.bookings || a.label.localeCompare(b.label, "fr"))
  const totalRow: GroupRow = {
    key: "total", label: "Total", metrics: metrics(total), spendBasis: total.spend > 0 ? "exacte" : "aucune",
    sufficient: total.bookings >= minBookings, hasProvisional: total.comProvisional !== 0,
  }

  // gagnante : meilleur RÉSULTAT (réservations rentables), pas le plus de leads ; échantillon suffisant exigé
  const candidates = rows.filter((r) => r.sufficient && r.metrics.spend > 0 && r.metrics.result > 0)
  const winner = candidates.length ? candidates.reduce((a, b) => (b.metrics.result > a.metrics.result ? b : a)) : null
  const winnerReason = winner
    ? "Meilleur résultat (commission nette − dépenses) parmi les lignes comparables."
    : rows.some((r) => r.metrics.spend > 0)
      ? `Aucune gagnante : il faut au moins ${minBookings} réservations, des dépenses et un résultat positif sur la même ligne.`
      : "Aucune gagnante : aucune dépense enregistrée."
  return { rows, total: totalRow, unattachedSpend: unattached, winnerKey: winner?.key ?? null, winnerReason }
}
