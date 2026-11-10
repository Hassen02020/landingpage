// Service central d'enregistrement d'un lead reçu d'un canal externe (formulaire instantané Meta ou TikTok,
// message WhatsApp entrant) dans le CRM Landing. Distinct du formulaire du site (lead-intake) : pas de requête
// navigateur, pas d'origine, pas de limite d'IP. La confiance vient de la SIGNATURE du webhook, vérifiée par l'appelant
// (voir webhook-auth.ts) AVANT d'appeler ce service.
//
// Règles :
//  • l'entreprise est PASSÉE EXPLICITEMENT (jamais déduite de la charge utile) : aucune fuite entre entreprises ;
//  • idempotence : `idempotency_key` = « plateforme:identifiant externe » (unique par entreprise en base) ;
//    un même événement reçu deux fois ne crée qu'un prospect (même téléphone + produit + jour : idem) ;
//  • prénom (≥ 2 caractères) et téléphone valides ; e-mail facultatif ; consentement de recontact OBLIGATOIRE
//    (sinon rien n'est enregistré) ; aucun identifiant publicitaire personnel, aucune IP ;
//  • aucun événement « Lead » renvoyé à Meta / TikTok : la plateforme d'origine a déjà compté ce lead.
import { DEFAULT_ORG_ID, isOrgId } from "@/lib/org-id"
import { randomRef, normalizePhone } from "@/lib/server/hash"
import { DbError, insertOne, runWithOrg, select, dbConfigured } from "@/lib/server/db"
import { logActivity, tunisDay } from "@/lib/server/crm"
import { notifyNewLead } from "@/lib/server/notify"
import { cleanEmail } from "@/lib/validation"

export type InboundPlatform = "facebook" | "instagram" | "tiktok" | "whatsapp"

const CHANNEL: Record<InboundPlatform, string> = { facebook: "meta", instagram: "meta", tiktok: "tiktok", whatsapp: "whatsapp" }
const PLATFORM_LABEL: Record<InboundPlatform, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp" }

export interface InboundLeadInput {
  platform: InboundPlatform
  /** identifiant du lead / du message chez la plateforme (leadgen_id Meta, Lead ID TikTok, wamid WhatsApp) */
  externalId: string
  name: string
  phone: string
  email?: string
  message?: string
  /** libellé de l'offre ou du formulaire (facultatif) */
  offer?: string
  formId?: string
  campaignId?: string
  adsetId?: string
  adId?: string
  /** true seulement si le formulaire de la plateforme demande bien d'être recontacté (texte légal conservé par la plateforme) */
  contactConsent: boolean
  /** notifier l'équipe d'Easy2Book (réservé à l'organisation de la plateforme) */
  notifyTeam?: boolean
}

export type InboundResult =
  | { ok: true; ref: string; leadId: string | null; duplicate: boolean }
  | { ok: false; reason: "invalid" | "no_consent" | "storage_unavailable" | "storage_error"; errors?: Record<string, string> }

const cut = (v: string | undefined, max: number) => (v ? v.trim().slice(0, max) : undefined)

/** Clé d'idempotence d'un événement externe (≤ 128 caractères, caractères sûrs). */
export function inboundKey(platform: InboundPlatform, externalId: string): string | null {
  const id = String(externalId ?? "").trim()
  if (!/^[A-Za-z0-9_.:=\-]{3,100}$/.test(id)) return null
  return `${platform}:${id}`
}

export async function ingestExternalLead(orgId: string, input: InboundLeadInput): Promise<InboundResult> {
  if (!isOrgId(orgId)) return { ok: false, reason: "invalid", errors: { organization: "Entreprise invalide" } }
  const key = inboundKey(input.platform, input.externalId)
  const errors: Record<string, string> = {}
  if (!key) errors.externalId = "Identifiant externe invalide"
  const name = (input.name ?? "").trim().replace(/\s+/g, " ")
  if (name.length < 2) errors.name = "Prénom requis"
  const phone = normalizePhone(String(input.phone ?? ""))
  if (!phone) errors.phone = "Téléphone invalide"
  const email = input.email ? cleanEmail(input.email) : null
  if (input.email && !email) errors.email = "E-mail invalide"
  if (Object.keys(errors).length) return { ok: false, reason: "invalid", errors }
  if (input.contactConsent !== true) return { ok: false, reason: "no_consent" }
  if (!dbConfigured()) return { ok: false, reason: "storage_unavailable" }

  const [firstName, ...rest] = name.split(" ")
  const label = PLATFORM_LABEL[input.platform]
  const base: Record<string, unknown> = {
    idempotency_key: key,
    first_name: cut(firstName, 100),
    last_name: cut(rest.join(" "), 100) || null,
    phone,
    product: "autre",
    offer: cut(input.offer, 255) || null,
    email: email || null,
    message: cut(input.message, 1000) || null,
    contact_channel: "whatsapp",
    // consentement : celui du formulaire de la plateforme (recontact) ; aucun marketing, aucun suivi publicitaire
    contact_consent: true,
    consent_text_version: `${input.platform}-lead-form`,
    marketing_consent: false,
    tracking_consent: false,
    // source
    channel: CHANNEL[input.platform],
    first_channel: CHANNEL[input.platform],
    utm_source: input.platform,
    utm_medium: input.platform === "whatsapp" ? "message_entrant" : "formulaire_instantane",
    first_utm_source: input.platform,
    campaign_id: cut(input.campaignId, 64) || null,
    adset_id: cut(input.adsetId, 64) || null,
    ad_id: cut(input.adId, 64) || null,
  }

  return await runWithOrg(orgId, async (): Promise<InboundResult> => {
    let ref = randomRef()
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const saved = await insertOne<{ id: string }>("landing_leads", { ...base, ref })
        const leadId = saved?.id ?? null
        if (leadId) {
          await logActivity(leadId, { id: null, label: "système" }, "created", {
            body: `Lead ${label} (${input.platform === "whatsapp" ? "message entrant" : "formulaire instantané"}) — identifiant externe ${String(input.externalId).slice(0, 40)}${input.formId ? `, formulaire ${String(input.formId).slice(0, 40)}` : ""}`,
          }).catch(() => console.error("[inbound] historique non écrit"))
        }
        if (input.notifyTeam && orgId === DEFAULT_ORG_ID) {
          await notifyNewLead({ id: leadId, ref, product: "autre", offer: input.offer, firstName, phone: phone!, source: `${label} (formulaire instantané)`, channel: CHANNEL[input.platform] }).catch(() => undefined)
        }
        return { ok: true, ref, leadId, duplicate: false }
      } catch (e) {
        if (!(e instanceof DbError && e.isUniqueViolation)) {
          console.error("[inbound] enregistrement impossible", e instanceof Error ? e.message : "erreur")
          return { ok: false, reason: "storage_error" }
        }
        // doublon : même événement externe, ou même téléphone + produit le même jour → référence existante
        try {
          const existing = await select<{ ref: string; id?: string }>(
            "landing_leads",
            `select=ref,id&or=(idempotency_key.eq.${encodeURIComponent(key!)},and(phone.eq.${phone},product.eq.autre,lead_day.eq.${tunisDay()}))&limit=1`
          )
          if (existing[0]) return { ok: true, ref: existing[0].ref, leadId: existing[0].id ?? null, duplicate: true }
        } catch {
          return { ok: false, reason: "storage_error" }
        }
        ref = randomRef() // collision sur la référence aléatoire : nouvel essai
      }
    }
    return { ok: false, reason: "storage_error" }
  })
}
