// Réception des messages WhatsApp (API Cloud de Meta) : webhook `messages`.
// Flux : signature vérifiée sur le CORPS BRUT → messages texte extraits → numéro WhatsApp Business rattaché à UNE entreprise
// (landing_whatsapp_numbers, migration 0024) → si le message porte la référence « E2B-XXXXXX » d'un clic ou d'un lead connu :
// il est rattaché à ce lead (historique) ; sinon un lead « WhatsApp » est créé (service central, idempotent).
// Rien n'est actif tant que WHATSAPP_VERIFY_TOKEN et WHATSAPP_APP_SECRET (ou META_APP_SECRET) ne sont pas définis (route inerte, 404).
//
// Confidentialité : le TEXTE du message n'est jamais conservé (seule sa référence E2B est lue), tant que la durée de conservation
// n'est pas décidée par le propriétaire. Le prospect a contacté l'entreprise lui-même : recontact au sujet de sa demande autorisé,
// aucun consentement marketing. Aucun message n'est envoyé par ce code (réception seule).
import { DEFAULT_ORG_ID, isOrgId } from "@/lib/org-id"
import { DbError, runWithOrg, select } from "@/lib/server/db"
import { ingestExternalLead } from "@/lib/server/inbound-leads"
import { recordInboundEvent, type InboundStatus } from "@/lib/server/inbound-events"
import { logActivity } from "@/lib/server/crm"
import { describeAttachment, lookupConversation, parseWaRef } from "@/lib/server/whatsapp"
import { metaChallenge, verifyMetaSignature } from "@/lib/server/webhook-auth"
import type { WebhookResult } from "@/lib/server/meta-leads"

const MAX_BODY = 256_000

export interface WaMessage {
  phoneNumberId: string
  wamid: string
  from: string
  type: string
  /** texte reçu : lu pour y trouver la référence, JAMAIS enregistré */
  text?: string
  profileName?: string
}

/** Extrait les messages d'une charge WhatsApp Cloud API. Ignore les statuts (lu, livré…) et tout le reste. */
export function parseWhatsAppPayload(json: unknown): WaMessage[] {
  const root = json as { object?: unknown; entry?: unknown }
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return []
  const out: WaMessage[] = []
  for (const entry of root.entry as { changes?: unknown }[]) {
    if (!entry || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes as { field?: unknown; value?: Record<string, unknown> }[]) {
      if (!ch || ch.field !== "messages" || !ch.value) continue
      const v = ch.value
      const phoneNumberId = String((v.metadata as { phone_number_id?: unknown } | undefined)?.phone_number_id ?? "")
      if (!/^\d{5,25}$/.test(phoneNumberId) || !Array.isArray(v.messages)) continue
      const contacts = Array.isArray(v.contacts) ? (v.contacts as { wa_id?: unknown; profile?: { name?: unknown } }[]) : []
      for (const m of v.messages as { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } }[]) {
        const wamid = String(m?.id ?? "")
        const from = String(m?.from ?? "")
        if (!/^[A-Za-z0-9_.=\-]{6,100}$/.test(wamid) || !/^\d{6,20}$/.test(from)) continue
        const contact = contacts.find((c) => String(c?.wa_id ?? "") === from)
        const profileName = String(contact?.profile?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 100)
        out.push({
          phoneNumberId,
          wamid,
          from,
          type: String(m.type ?? ""),
          text: m.type === "text" ? String(m.text?.body ?? "").slice(0, 4096) : undefined,
          ...(profileName ? { profileName } : {}),
        })
      }
    }
  }
  return out
}

type Outcome = "ok" | "duplicate" | "ignored" | "dropped" | "retry"
interface Decision { outcome: Outcome; reason: string; orgId?: string }
interface NumberRow { phone_number_id: string; organization_id: string; enabled: boolean }

const missing = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)

async function loadNumber(id: string): Promise<{ row: NumberRow | null; unavailable: boolean }> {
  try {
    const rows = await select<NumberRow>("landing_whatsapp_numbers", `select=phone_number_id,organization_id,enabled&phone_number_id=eq.${encodeURIComponent(id)}&limit=1`)
    return { row: rows[0] ?? null, unavailable: false }
  } catch (e) {
    if (missing(e)) return { row: null, unavailable: false } // migration 0024 non appliquée : rien n'est configuré
    return { row: null, unavailable: true }
  }
}

/** Le message a-t-il déjà été traité (même identifiant WhatsApp) ? Évite une 2ᵉ ligne d'historique si Meta rejoue l'événement. */
async function alreadyHandled(orgId: string, wamid: string): Promise<boolean> {
  try {
    const rows = await runWithOrg(orgId, () =>
      select<{ id: number }>("landing_inbound_events", `select=id&platform=eq.whatsapp&external_id=eq.${encodeURIComponent(wamid)}&status=in.(created,duplicate)&limit=1`)
    )
    return rows.length > 0
  } catch {
    return false // journal absent ou illisible : le service central reste idempotent pour les nouveaux leads
  }
}

async function decide(m: WaMessage): Promise<Decision> {
  const { row, unavailable } = await loadNumber(m.phoneNumberId)
  if (unavailable) return { outcome: "retry", reason: "base_indisponible" }
  if (!row) {
    console.warn("[whatsapp] numéro non rattaché, message ignoré", { phoneNumberId: m.phoneNumberId })
    return { outcome: "ignored", reason: "numero_inconnu" }
  }
  const orgId = row.organization_id
  if (!row.enabled) return { outcome: "ignored", reason: "numero_desactive", orgId }
  if (m.type !== "text") return { outcome: "ignored", reason: `type_${m.type || "inconnu"}`.slice(0, 40), orgId } // images, vocaux… : pas de lead
  if (await alreadyHandled(orgId, m.wamid)) return { outcome: "duplicate", reason: "deja_traite", orgId }

  const ref = parseWaRef(m.text)
  const conv = ref ? await Promise.resolve(runWithOrg(orgId, () => lookupConversation(ref))).catch(() => null) : null
  // une référence connue : le message est rattaché au lead existant (aucun doublon)
  if (conv?.lead && !conv.lead.anonymized_at) {
    try {
      await runWithOrg(orgId, () =>
        logActivity(conv.lead!.id, { id: null, label: "système" }, "wa_in", { body: `Message WhatsApp reçu et rattaché à ce lead (réf. ${conv.ref}) — texte non conservé` })
      )
      return { outcome: "duplicate", reason: "rattache_lead_existant", orgId }
    } catch {
      return { outcome: "retry", reason: "historique_non_ecrit", orgId }
    }
  }
  const click = conv?.clicks[0]
  const r = await ingestExternalLead(orgId, {
    platform: "whatsapp",
    externalId: m.wamid,
    name: m.profileName && m.profileName.length >= 2 ? m.profileName : "Contact WhatsApp",
    phone: `+${m.from}`,
    contactConsent: true, // le prospect a écrit lui-même
    notifyTeam: orgId === DEFAULT_ORG_ID,
    ...(ref ? { visitorRef: ref } : {}),
    ...(click ? { origin: { channel: click.channel, utm_source: click.utm_source, utm_campaign: click.utm_campaign, utm_content: click.utm_content, ad_id: click.ad_id } } : {}),
    note: conv ? describeAttachment(conv) : "aucune référence E2B dans le message : origine inconnue",
  })
  if (r.ok) return { outcome: r.duplicate ? "duplicate" : "ok", reason: r.duplicate ? "deja_recu" : "cree", orgId }
  if (r.reason === "storage_unavailable" || r.reason === "storage_error") return { outcome: "retry", reason: r.reason, orgId }
  console.error("[whatsapp] lead refusé", { reason: r.reason, champs: r.errors ? Object.keys(r.errors) : undefined })
  return { outcome: "dropped", reason: r.errors ? `refuse_${Object.keys(r.errors).join("_")}`.slice(0, 100) : `refuse_${r.reason}`, orgId }
}

const STATUS_OF: Record<Outcome, InboundStatus> = { ok: "created", duplicate: "duplicate", ignored: "ignored", dropped: "dropped", retry: "retry" }

async function processMessage(m: WaMessage): Promise<Outcome> {
  const d = await decide(m)
  if (d.orgId && isOrgId(d.orgId)) await recordInboundEvent(d.orgId, { platform: "whatsapp", externalId: m.wamid, sourceRef: m.phoneNumberId, status: STATUS_OF[d.outcome], reason: d.reason })
  return d.outcome
}

const appSecret = () => process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || ""

/** GET : vérification d'abonnement. Route inerte (404) tant que WHATSAPP_VERIFY_TOKEN n'est pas défini. */
export function handleWhatsAppGet(params: URLSearchParams): WebhookResult {
  const token = process.env.WHATSAPP_VERIFY_TOKEN || ""
  if (!token) return { status: 404, body: "" }
  const challenge = metaChallenge(params, token)
  return challenge ? { status: 200, body: challenge, contentType: "text/plain" } : { status: 403, body: "" }
}

/** POST : messages. Route inerte (404) tant qu'aucun secret d'application n'est défini. */
export async function handleWhatsAppPost(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const secret = appSecret()
  if (!secret || !process.env.WHATSAPP_VERIFY_TOKEN) return { status: 404, body: "" }
  if (rawBody.length > MAX_BODY) return { status: 413, body: "" }
  if (!verifyMetaSignature(rawBody, signature, secret)) return { status: 401, body: "" }
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return { status: 400, body: "" }
  }
  const messages = parseWhatsAppPayload(json)
  const outcomes: Outcome[] = []
  for (const m of messages) outcomes.push(await processMessage(m))
  const retry = outcomes.includes("retry")
  return { status: retry ? 500 : 200, body: JSON.stringify({ received: messages.length, retry }), contentType: "application/json" }
}
