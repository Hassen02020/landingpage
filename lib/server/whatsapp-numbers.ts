// Numéros WhatsApp Business rattachés à une entreprise (table landing_whatsapp_numbers, migration 0024).
// Réception seule : aucun jeton d'envoi n'est stocké. Un numéro appartient à UNE seule entreprise.
import { DbError, insertOne, select, update } from "@/lib/server/db"
import { isOrgId } from "@/lib/org-id"

export interface WhatsAppNumberView { phone_number_id: string; display_phone: string | null; enabled: boolean; updated_at: string }
export interface WhatsAppNumberInput { phoneNumberId: string; displayPhone: string; enabled: boolean }
export type WaSaveResult = { ok: true } | { ok: false; errors: Record<string, string>; message?: string }

const NUMBER_ID = /^\d{5,25}$/
const missing = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)

export async function listWhatsAppNumbers(orgId: string): Promise<{ numbers: WhatsAppNumberView[]; migrationApplied: boolean }> {
  if (!isOrgId(orgId)) return { numbers: [], migrationApplied: true }
  try {
    const rows = await select<WhatsAppNumberView>("landing_whatsapp_numbers", `select=phone_number_id,display_phone,enabled,updated_at&organization_id=eq.${orgId}&order=created_at.asc`)
    return { numbers: rows.map((r) => ({ phone_number_id: r.phone_number_id, display_phone: r.display_phone ?? null, enabled: Boolean(r.enabled), updated_at: r.updated_at })), migrationApplied: true }
  } catch (e) {
    if (missing(e)) return { numbers: [], migrationApplied: false }
    return { numbers: [], migrationApplied: true }
  }
}

export async function saveWhatsAppNumber(orgId: string, actorId: string | null, input: WhatsAppNumberInput): Promise<WaSaveResult> {
  if (!isOrgId(orgId)) return { ok: false, errors: {}, message: "Entreprise inconnue." }
  const id = String(input.phoneNumberId ?? "").trim()
  const display = String(input.displayPhone ?? "").trim().slice(0, 30)
  const errors: Record<string, string> = {}
  if (!NUMBER_ID.test(id)) errors.phoneNumberId = "Identifiant du numéro : 5 à 25 chiffres (Meta Business > WhatsApp > numéro de téléphone), différent du numéro affiché."
  if (Object.keys(errors).length) return { ok: false, errors }
  try {
    const existing = await select<{ organization_id: string }>("landing_whatsapp_numbers", `select=organization_id&phone_number_id=eq.${id}&limit=1`)
    if (existing[0] && existing[0].organization_id !== orgId) return { ok: false, errors: { phoneNumberId: "Ce numéro est déjà rattaché à une autre entreprise." } }
    const common = { display_phone: display || null, enabled: input.enabled, updated_at: new Date().toISOString(), updated_by: actorId }
    if (existing[0]) await update("landing_whatsapp_numbers", `phone_number_id=eq.${id}&organization_id=eq.${orgId}`, common)
    else await insertOne("landing_whatsapp_numbers", { phone_number_id: id, organization_id: orgId, ...common })
    return { ok: true }
  } catch (e) {
    if (e instanceof DbError && e.isUniqueViolation) return { ok: false, errors: { phoneNumberId: "Ce numéro est déjà rattaché à une autre entreprise." } }
    if (missing(e)) return { ok: false, errors: {}, message: "La migration 0024 n'est pas encore appliquée dans Supabase." }
    console.error("[whatsapp-numbers] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, errors: {}, message: "Enregistrement impossible. Réessayez." }
  }
}
