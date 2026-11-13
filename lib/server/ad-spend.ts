// Dépenses publicitaires (table landing_ad_spend, migration 0016) : saisie manuelle aujourd'hui, API demain.
// Registre à AJOUT SEUL : une erreur se corrige par une écriture d'annulation (montant exactement opposé), jamais en modifiant.
// L'organisation est portée par le contexte de la requête (table cloisonnée) : jamais lue dans un formulaire.
import { DbError, insertOne, select } from "@/lib/server/db"
import { parseAmount, parseDate } from "@/lib/commission-import"
import { tunisDay } from "@/lib/server/crm"

export interface AdSpendRow {
  id: number
  spend_date: string
  network: "meta" | "tiktok"
  campaign: string
  amount_tnd: number | string
  voids_id: number | null
  reference: string | null
  source: string
  created_at: string
}
export interface AdSpendInput { date: string; network: string; campaign: string; amount: string; reference?: string }
export type SpendResult = { ok: true } | { ok: false; errors: Record<string, string>; message?: string }

export const isMissingTable = (e: unknown): boolean => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)

export async function listAdSpend(days = 120): Promise<{ rows: AdSpendRow[]; migrationApplied: boolean }> {
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  try {
    const rows = await select<AdSpendRow>("landing_ad_spend", `select=id,spend_date,network,campaign,amount_tnd,voids_id,reference,source,created_at&spend_date=gte.${from}&order=spend_date.desc,id.desc&limit=500`)
    return { rows, migrationApplied: true }
  } catch (e) {
    if (isMissingTable(e)) return { rows: [], migrationApplied: false }
    console.error("[ad-spend] lecture impossible", e instanceof Error ? e.message : "erreur")
    return { rows: [], migrationApplied: true }
  }
}

export async function addAdSpend(input: AdSpendInput, actorId: string | null): Promise<SpendResult> {
  const errors: Record<string, string> = {}
  const date = parseDate(String(input.date ?? ""))
  if (!date) errors.date = "Date invalide (AAAA-MM-JJ)."
  else if (date > nextDay(tunisDay())) errors.date = "La date ne peut pas être dans le futur."
  if (input.network !== "meta" && input.network !== "tiktok") errors.network = "Réseau : Meta ou TikTok."
  const campaign = String(input.campaign ?? "").trim().replace(/\s+/g, " ")
  if (campaign.length < 1 || campaign.length > 255) errors.campaign = "Campagne requise (255 caractères maximum)."
  const amount = parseAmount(String(input.amount ?? ""))
  if (amount === null) errors.amount = "Montant en TND invalide (supérieur à 0)."
  const reference = String(input.reference ?? "").trim().slice(0, 200)
  if (Object.keys(errors).length) return { ok: false, errors }
  try {
    await insertOne("landing_ad_spend", { spend_date: date, network: input.network, campaign, amount_tnd: amount, reference: reference || null, source: "manuel", created_by: actorId })
    return { ok: true }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, errors: {}, message: "La migration 0016 n'est pas encore appliquée dans Supabase." }
    console.error("[ad-spend] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}

/** Annule une dépense : ajoute l'écriture opposée (même campagne, même date). Refuse une annulation, ou une dépense déjà annulée. */
export async function voidAdSpend(id: number, actorId: string | null): Promise<SpendResult> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, errors: {}, message: "Dépense inconnue." }
  try {
    const rows = await select<AdSpendRow>("landing_ad_spend", `select=id,spend_date,network,campaign,amount_tnd,voids_id&id=eq.${id}&limit=1`)
    const o = rows[0]
    if (!o) return { ok: false, errors: {}, message: "Dépense inconnue." }
    if (o.voids_id != null) return { ok: false, errors: {}, message: "Une écriture d'annulation ne s'annule pas." }
    const already = await select<{ id: number }>("landing_ad_spend", `select=id&voids_id=eq.${id}&limit=1`)
    if (already[0]) return { ok: false, errors: {}, message: "Cette dépense est déjà annulée." }
    await insertOne("landing_ad_spend", {
      spend_date: o.spend_date, network: o.network, campaign: o.campaign, amount_tnd: -Number(o.amount_tnd), voids_id: id,
      reference: `Annulation de la dépense n° ${id}`, source: "manuel", created_by: actorId,
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof DbError && e.isUniqueViolation) return { ok: false, errors: {}, message: "Cette dépense est déjà annulée." }
    if (isMissingTable(e)) return { ok: false, errors: {}, message: "La migration 0016 n'est pas encore appliquée dans Supabase." }
    console.error("[ad-spend] annulation impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Annulation impossible. Réessayez." }
  }
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
