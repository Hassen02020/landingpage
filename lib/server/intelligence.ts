// Intelligence Center — chargement (lecture seule) pour la vue d'ensemble et la qualité des données.
// Cloisonné par entreprise (contexte de la requête, comme les autres chargements). Aucun contenu de lead n'est renvoyé :
// seulement des champs techniques servant à des comptages.
import { select } from "@/lib/server/db"
import { loadAnalytics } from "@/lib/server/analytics"
import { loadProfitability } from "@/lib/server/profitability"
import { periodFilter, type Period } from "@/lib/server/stats"
import { isUntreated } from "@/lib/status"
import { overviewAlerts, qualityReport, type OverviewAlert, type OverviewInput, type QualityLead, type QualityReport } from "@/lib/intelligence"

const LIMIT = 10000
const BASE = "id,created_at,status,channel,utm_campaign,tracking_consent"
// colonnes facultatives selon les migrations appliquées : on essaie la lecture complète, puis on retire ce que la base ne connaît pas
const COL_SETS: { cols: string; governance: boolean }[] = [
  { cols: `${BASE},region,is_test,lost_reason,purchased_product`, governance: true },
  { cols: `${BASE},region`, governance: false },
  { cols: BASE, governance: false },
]

export async function loadQualityLeads(p: Period): Promise<{ leads: QualityLead[]; governanceColumns: boolean; truncated: boolean }> {
  for (let i = 0; i < COL_SETS.length; i++) {
    try {
      const leads = await select<QualityLead>("landing_leads", `select=${COL_SETS[i].cols}&${periodFilter("created_at", p)}&limit=${LIMIT}`)
      return { leads, governanceColumns: COL_SETS[i].governance, truncated: leads.length >= LIMIT }
    } catch (e) {
      if (i === COL_SETS.length - 1) throw e
    }
  }
  return { leads: [], governanceColumns: false, truncated: false }
}

export interface QualityData extends QualityReport { truncated: boolean; governanceColumns: boolean; financeIncluded: boolean }

/** `finance` : l'utilisateur a le droit « ads.view » (lecture des commissions). */
export async function loadQuality(p: Period, finance: boolean): Promise<QualityData> {
  const { leads, governanceColumns, truncated } = await loadQualityLeads(p)
  let bookingsWithoutCommission: number | null = null
  if (finance) bookingsWithoutCommission = (await loadProfitability(p, "network")).result.total.metrics.bookingsWithoutCommission
  return { ...qualityReport(leads, { bookingsWithoutCommission, governanceColumns }), truncated, governanceColumns, financeIncluded: finance }
}

export interface OverviewData extends OverviewInput { alerts: OverviewAlert[]; financeIncluded: boolean; period: Period; funnel: { key: string; label: string; count: number }[] }

export async function loadOverview(p: Period, finance: boolean): Promise<OverviewData> {
  const a = await loadAnalytics(p)
  const count = (key: string) => a.funnel.find((s) => s.key === key)?.count ?? 0
  const untreated = a.leads.filter((l) => isUntreated(l.status)).length
  let spend: number | null = null
  let marginConfirmed: number | null = null
  let unattachedSpendCount = 0
  if (finance) {
    const r = (await loadProfitability(p, "network")).result
    spend = r.total.metrics.spend
    marginConfirmed = r.total.metrics.marginConfirmed
    unattachedSpendCount = r.unattachedSpend.length
  }
  const input: OverviewInput = { leads: a.leads.length, qualified: count("qualifies"), bookings: count("reserves"), spend, marginConfirmed, unattachedSpendCount, untreated }
  return { ...input, alerts: overviewAlerts(input), financeIncluded: finance, period: p, funnel: a.funnel.map((s) => ({ key: s.key, label: s.label, count: s.count })) }
}
