// Coûts variables hors publicité (table landing_variable_costs, migration 0017). Ajout seul ; annulation par écriture opposée.
// Anti double comptage : un coût se rattache à UNE réservation (référence dossier E2B-XXXXXX) OU à UNE campagne OU à rien.
// La publicité (table landing_ad_spend) et le remboursement client (ligne négative du registre des commissions) ne sont PAS des catégories.
import { insertOne, select } from "@/lib/server/db"
import { parseAmount, parseDate, LEAD_REF } from "@/lib/commission-import"
import { tunisDay } from "@/lib/server/crm"
import { CAMPAIGN_EXAMPLE, isConventionalCampaign, suggestCampaignName } from "@/lib/campaign-name"
import { isMissingTable, type SpendResult } from "@/lib/server/ad-spend"

import { COST_CATEGORIES, type CostCategory } from "@/lib/variable-cost-categories"
export { COST_CATEGORIES, COST_LABELS, type CostCategory } from "@/lib/variable-cost-categories"

export interface CostRowDb {
  id: number
  cost_date: string
  category: CostCategory
  amount_tnd: number | string
  lead_id: string | null
  network: "meta" | "tiktok" | null
  campaign: string | null
  voids_id: number | null
  reference: string | null
}
export interface CostInput { date: string; category: string; amount: string; leadRef?: string; network?: string; campaign?: string; reference?: string }

export async function listVariableCosts(days = 120): Promise<{ rows: CostRowDb[]; migrationApplied: boolean }> {
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  try {
    const rows = await select<CostRowDb>("landing_variable_costs", `select=id,cost_date,category,amount_tnd,lead_id,network,campaign,voids_id,reference&cost_date=gte.${from}&order=cost_date.desc,id.desc&limit=500`)
    return { rows, migrationApplied: true }
  } catch (e) {
    if (isMissingTable(e)) return { rows: [], migrationApplied: false }
    console.error("[variable-costs] lecture impossible", e instanceof Error ? e.message : "erreur")
    return { rows: [], migrationApplied: true }
  }
}

export async function addVariableCost(input: CostInput, actorId: string | null): Promise<SpendResult> {
  const errors: Record<string, string> = {}
  const date = parseDate(String(input.date ?? ""))
  if (!date) errors.date = "Date invalide (AAAA-MM-JJ)."
  else if (date > tunisDay(new Date(Date.now() + 86400_000))) errors.date = "La date ne peut pas être dans le futur."
  if (!(COST_CATEGORIES as readonly string[]).includes(input.category)) errors.category = "Catégorie inconnue. La publicité et les remboursements ne se saisissent pas ici."
  const amount = parseAmount(String(input.amount ?? ""))
  if (amount === null) errors.amount = "Montant en TND invalide (supérieur à 0)."
  const leadRef = String(input.leadRef ?? "").trim().toUpperCase()
  const campaign = String(input.campaign ?? "").trim().replace(/\s+/g, " ")
  const network = String(input.network ?? "")
  if (leadRef && (campaign || network)) errors.leadRef = "Rattachez le coût à une réservation OU à une campagne, pas aux deux (il serait compté deux fois)."
  if (leadRef && !LEAD_REF.test(leadRef)) errors.leadRef = "Référence de dossier invalide (E2B-XXXXXX)."
  if (!leadRef && (campaign || network)) {
    if (network !== "meta" && network !== "tiktok") errors.network = "Réseau : Meta ou TikTok."
    if (campaign.length < 1 || campaign.length > 255) errors.campaign = "Campagne requise (255 caractères maximum)."
    else if (!isConventionalCampaign(campaign)) errors.campaign = `Nom hors convention (ex. ${CAMPAIGN_EXAMPLE}). Proposition : ${suggestCampaignName(campaign) || CAMPAIGN_EXAMPLE}.`
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  try {
    let leadId: string | null = null
    if (leadRef) {
      const hit = await select<{ id: string }>("landing_leads", `select=id&ref=eq.${encodeURIComponent(leadRef)}&limit=1`)
      if (!hit[0]) return { ok: false, errors: { leadRef: "Dossier introuvable dans cette entreprise." } }
      leadId = hit[0].id
    }
    const attach = !leadId && campaign ? { network, campaign } : { network: null, campaign: null }
    await insertOne("landing_variable_costs", { cost_date: date, category: input.category, amount_tnd: amount, lead_id: leadId, ...attach, reference: String(input.reference ?? "").trim().slice(0, 200) || null, created_by: actorId })
    return { ok: true }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, errors: {}, message: "La migration 0017 n'est pas encore appliquée dans Supabase." }
    console.error("[variable-costs] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}

export async function voidVariableCost(id: number, actorId: string | null): Promise<SpendResult> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, errors: {}, message: "Coût inconnu." }
  try {
    const o = (await select<CostRowDb>("landing_variable_costs", `select=id,cost_date,category,amount_tnd,lead_id,network,campaign,voids_id&id=eq.${id}&limit=1`))[0]
    if (!o) return { ok: false, errors: {}, message: "Coût inconnu." }
    if (o.voids_id != null) return { ok: false, errors: {}, message: "Une écriture d'annulation ne s'annule pas." }
    if ((await select<{ id: number }>("landing_variable_costs", `select=id&voids_id=eq.${id}&limit=1`))[0]) return { ok: false, errors: {}, message: "Ce coût est déjà annulé." }
    await insertOne("landing_variable_costs", {
      cost_date: o.cost_date, category: o.category, amount_tnd: -Number(o.amount_tnd), lead_id: o.lead_id, network: o.network, campaign: o.campaign,
      voids_id: id, reference: `Annulation du coût n° ${id}`, created_by: actorId,
    })
    return { ok: true }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, errors: {}, message: "La migration 0017 n'est pas encore appliquée dans Supabase." }
    console.error("[variable-costs] annulation impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Annulation impossible. Réessayez." }
  }
}
