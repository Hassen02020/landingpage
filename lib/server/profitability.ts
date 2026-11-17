// Chargement des données de rentabilité (lecture seule) pour l'écran d'analyse. EasyV4 reste la référence financière :
// on ne lit ici que ce qui a été saisi ou importé dans Landing, cloisonné par entreprise (contexte de la requête).
// Cohorte = leads CRÉÉS sur la période ; dépenses et coûts = datés sur la période.
import { select } from "@/lib/server/db"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { economics, type CommissionRow, type CostRow, type Dimension, type EconLead, type EconomicsResult, type SpendRow } from "@/lib/ad-economics"
import type { FunnelActivity } from "@/lib/server/analytics"
import { isMissingTable } from "@/lib/server/ad-spend"
import { periodFilter, type Period } from "@/lib/server/stats"

export interface ProfitabilityData { result: EconomicsResult; migrationApplied: boolean; leadCount: number; truncated: boolean }

const MAX = 10000

async function safe<T>(table: string, query: string, flag: { missing: boolean }): Promise<T[]> {
  try { return await select<T>(table, query) } catch (e) {
    if (isMissingTable(e)) { flag.missing = true; return [] }
    throw e
  }
}

export async function loadProfitability(p: Period, dim: Dimension): Promise<ProfitabilityData> {
  const flag = { missing: false }
  // Colonnes facultatives selon les migrations appliquées : région (0006), tranche d'âge (migration 0027, si appliquée). On essaie la lecture
  // complète, puis on retire la tranche d'âge, puis la région, plutôt que d'afficher une page d'erreur sur une base pas encore à jour.
  const BASE_COLS = "id,created_at,status,booking_value,booked_at,channel,utm_campaign,utm_content,ad_id,product,niche"
  const COL_SETS = [`${BASE_COLS},utm_term,adset_id,region,age_range`, `${BASE_COLS},utm_term,adset_id,region`, `${BASE_COLS},utm_term,adset_id`]
  let leads: EconLead[] = []
  for (let i = 0; i < COL_SETS.length; i++) {
    try {
      leads = await selectRealLeads<EconLead>(`select=${COL_SETS[i]}&${periodFilter("created_at", p)}&limit=${MAX}`)
      break
    } catch (e) {
      if (i === COL_SETS.length - 1) throw e
    }
  }
  const ids = new Set(leads.map((l) => l.id))
  const rawActs = await select<FunnelActivity>("landing_lead_activities", `select=lead_id,type,to_status,created_at,actor_id&limit=50000`)
  const activities = rawActs.filter((a) => ids.has(a.lead_id))
  const dateRange = (col: string) => `${col}=gte.${p.from}&${col}=lte.${p.to}`
  const spends = await safe<SpendRow>("landing_ad_spend", `select=id,spend_date,network,campaign,amount_tnd,voids_id&${dateRange("spend_date")}&limit=${MAX}`, flag)
  const costs = await safe<CostRow>("landing_variable_costs", `select=category,amount_tnd,voids_id,lead_id,network,campaign&${dateRange("cost_date")}&limit=${MAX}`, flag)
  const allCommissions = await safe<CommissionRow>("landing_commissions", `select=lead_id,kind,amount_tnd,status&limit=${MAX}`, flag)
  const commissions = allCommissions.filter((c) => ids.has(c.lead_id))
  return {
    result: economics({ leads, activities, spends, costs, commissions }, dim),
    migrationApplied: !flag.missing,
    leadCount: leads.length,
    truncated: leads.length >= MAX,
  }
}
