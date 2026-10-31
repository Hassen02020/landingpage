// Transmission des leads au CRM Easy2Book (EasyV4) — AUCUN stockage dans ce projet.
//
// Contrat : corps identique au schéma `inputSchema` de l'action serveur EasyV4
// `app/actions/submit-lead.ts` (dépôt Hassen02020/EasyV4), qui appelle
// `captureWebsiteLeadCore` (lead + origine + contact + consentement marketing).
// Cette action n'est appelable que depuis le site EasyV4 lui-même : EasyV4 doit
// exposer un endpoint HTTP serveur-à-serveur qui l'enveloppe (voir README,
// « Prérequis côté EasyV4 »). Tant que EASYV4_LEAD_INTAKE_URL n'est pas défini,
// rien n'est transmis et le prospect est orienté vers WhatsApp.

export const EASYV4_PRODUCT_TYPES = ["hotel", "omra", "package", "activity", "general"] as const
export const EASYV4_INTENTIONS = ["groupe", "transfert", "a_la_carte", "standard"] as const

export interface EasyV4LeadInput {
  firstName: string // 1..100
  lastName?: string // ..100
  email?: string // ..320
  phone?: string // ..32
  message?: string // ..2000
  productType: (typeof EASYV4_PRODUCT_TYPES)[number]
  productRef?: string // ..128
  productLabel?: string // ..255
  sourcePage: string // 1..255
  destination?: string // ..128
  intention: (typeof EASYV4_INTENTIONS)[number]
  campaignRef?: string // ..255
  marketingConsent: boolean
}

export function crmConfigured(): boolean {
  return Boolean(process.env.EASYV4_LEAD_INTAKE_URL && process.env.EASYV4_LEAD_INTAKE_TOKEN)
}

export type CrmResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "rejected" | "unreachable"; status?: number }

/**
 * Envoie le lead à EasyV4. `idempotencyKey` (= event_id du formulaire) est transmis
 * en en-tête pour qu'EasyV4 puisse ignorer un double envoi.
 */
export async function forwardLeadToCrm(input: EasyV4LeadInput, idempotencyKey: string): Promise<CrmResult> {
  const url = process.env.EASYV4_LEAD_INTAKE_URL
  const token = process.env.EASYV4_LEAD_INTAKE_TOKEN
  if (!url || !token) return { ok: false, reason: "not_configured" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) {
      // ne jamais journaliser le corps envoyé (données personnelles)
      console.error("[crm] EasyV4 a refusé le lead", res.status)
      return { ok: false, reason: "rejected", status: res.status }
    }
    return { ok: true }
  } catch (error) {
    console.error("[crm] EasyV4 injoignable", error instanceof Error ? error.name : "error")
    return { ok: false, reason: "unreachable" }
  } finally {
    clearTimeout(timer)
  }
}
