// Réception des formulaires instantanés Meta (Facebook, Instagram) : webhook `leadgen`.
// Flux : signature vérifiée sur le CORPS BRUT → événements `leadgen` extraits → page Facebook rattachée à UNE entreprise
// → lecture du lead par l'API Graph avec le jeton de la Page → service central d'enregistrement (idempotent, consentement,
// cloisonnement). Rien n'est actif tant que META_APP_SECRET et META_LEADS_VERIFY_TOKEN ne sont pas définis (route inerte, 404).
//
// Reprises : une erreur TEMPORAIRE (réseau, 5xx, limite de débit, base indisponible) renvoie 500 → Meta renvoie l'événement ;
// l'idempotence garantit qu'il ne crée jamais deux prospects. Une erreur PERMANENTE (jeton invalide, lead supprimé, page non
// reconnue, consentement non confirmé) renvoie 200 pour éviter des reprises inutiles et est journalisée sans donnée personnelle.
import { DEFAULT_ORG_ID } from "@/lib/org-id"
import { DbError, select } from "@/lib/server/db"
import { SecretBoxError, open } from "@/lib/server/secret-box"
import { ingestExternalLead, type InboundPlatform } from "@/lib/server/inbound-leads"
import { metaChallenge, verifyMetaSignature } from "@/lib/server/webhook-auth"

const GRAPH = "https://graph.facebook.com/v21.0"
const MAX_BODY = 256_000
export interface WebhookResult { status: number; body: string; contentType?: string }

export interface LeadgenEvent { leadgenId: string; pageId: string; formId?: string; adId?: string; adgroupId?: string; createdTime?: number }

/** Extrait les événements `leadgen` d'une charge Meta (objet « page »). Ignore tout le reste. */
export function parseLeadgenPayload(json: unknown): LeadgenEvent[] {
  const root = json as { object?: unknown; entry?: unknown }
  if (!root || root.object !== "page" || !Array.isArray(root.entry)) return []
  const out: LeadgenEvent[] = []
  for (const entry of root.entry as { id?: unknown; changes?: unknown }[]) {
    if (!entry || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes as { field?: unknown; value?: Record<string, unknown> }[]) {
      if (!ch || ch.field !== "leadgen" || !ch.value) continue
      const v = ch.value
      const leadgenId = String(v.leadgen_id ?? "")
      const pageId = String(v.page_id ?? entry.id ?? "")
      if (!/^\d{5,30}$/.test(leadgenId) || !/^\d{5,25}$/.test(pageId)) continue
      const opt = (x: unknown) => (x === undefined || x === null || !/^\d{1,30}$/.test(String(x)) ? undefined : String(x))
      out.push({ leadgenId, pageId, formId: opt(v.form_id), adId: opt(v.ad_id), adgroupId: opt(v.adgroup_id), createdTime: typeof v.created_time === "number" ? v.created_time : undefined })
    }
  }
  return out
}

export interface GraphLead {
  created_time?: string
  ad_id?: string
  ad_name?: string
  adset_id?: string
  campaign_id?: string
  form_id?: string
  platform?: string
  field_data?: { name?: string; values?: string[] }[]
}

const STANDARD = new Set(["full_name", "first_name", "last_name", "email", "phone_number"])

/** Convertit les champs d'un formulaire Meta en prospect (prénom/nom, téléphone, e-mail ; le reste va dans le message). */
export function mapFieldData(fieldData: GraphLead["field_data"]): { name: string; phone: string; email?: string; message?: string } {
  const get = (k: string) => {
    const f = (fieldData ?? []).find((x) => x?.name === k)
    return String(f?.values?.[0] ?? "").trim()
  }
  const full = get("full_name") || [get("first_name"), get("last_name")].filter(Boolean).join(" ")
  const phone = get("phone_number").replace(/^p:/i, "")
  const email = get("email")
  const extras = (fieldData ?? [])
    .filter((f) => f?.name && !STANDARD.has(f.name) && (f.values ?? []).some((v) => String(v).trim()))
    .map((f) => `${String(f.name).replace(/_/g, " ")} : ${(f.values ?? []).join(", ")}`)
    .join(" · ")
  return { name: full, phone, ...(email ? { email } : {}), ...(extras ? { message: extras.slice(0, 1000) } : {}) }
}

type Outcome = "ok" | "duplicate" | "ignored" | "dropped" | "retry"

// Codes d'erreur Graph temporaires (à rejouer) : indisponibilité, limite de débit, délai dépassé.
const TEMPORARY_CODES = new Set([1, 2, 4, 17, 32, 341, 613])

interface PageRow { page_id: string; organization_id: string; enabled: boolean; consent_confirmed: boolean; token_ciphertext: string }

async function loadPage(pageId: string): Promise<{ page: PageRow | null; unavailable: boolean }> {
  try {
    const rows = await select<PageRow>("landing_meta_pages", `select=page_id,organization_id,enabled,consent_confirmed,token_ciphertext&page_id=eq.${encodeURIComponent(pageId)}&limit=1`)
    return { page: rows[0] ?? null, unavailable: false }
  } catch (e) {
    // table absente (migration 0015 non appliquée) : rien n'est configuré, rien à reprendre
    if (e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)) return { page: null, unavailable: false }
    return { page: null, unavailable: true }
  }
}

async function fetchLead(leadgenId: string, token: string): Promise<{ lead?: GraphLead; outcome?: Outcome; code?: number }> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(leadgenId)}?fields=created_time,ad_id,ad_name,adset_id,campaign_id,form_id,platform,field_data`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as GraphLead & { error?: { code?: number } }
    if (res.ok && !json.error) return { lead: json }
    const code = json.error?.code
    if (res.status >= 500 || res.status === 429 || (code !== undefined && TEMPORARY_CODES.has(code))) return { outcome: "retry", code }
    return { outcome: "dropped", code }
  } catch {
    return { outcome: "retry" }
  }
}

async function processEvent(e: LeadgenEvent): Promise<Outcome> {
  const { page, unavailable } = await loadPage(e.pageId)
  if (unavailable) return "retry"
  if (!page || !page.enabled) {
    console.warn("[meta-leads] page non rattachée ou désactivée, événement ignoré", { pageId: e.pageId })
    return "ignored"
  }
  if (!page.consent_confirmed) {
    console.warn("[meta-leads] consentement de recontact non confirmé pour cette page : lead non enregistré", { pageId: e.pageId, leadgenId: e.leadgenId })
    return "ignored"
  }
  let token: string
  try {
    token = open(page.token_ciphertext)
  } catch (err) {
    console.error("[meta-leads] jeton de Page illisible", err instanceof SecretBoxError ? err.message : "erreur", { pageId: e.pageId })
    return "dropped"
  }
  const got = await fetchLead(e.leadgenId, token)
  if (!got.lead) {
    console.error("[meta-leads] lecture du lead impossible", { leadgenId: e.leadgenId, code: got.code, outcome: got.outcome })
    return got.outcome ?? "dropped"
  }
  const f = mapFieldData(got.lead.field_data)
  const platform: InboundPlatform = got.lead.platform === "ig" ? "instagram" : "facebook"
  const r = await ingestExternalLead(page.organization_id, {
    platform,
    externalId: e.leadgenId,
    name: f.name,
    phone: f.phone,
    email: f.email,
    message: f.message,
    offer: got.lead.ad_name,
    formId: got.lead.form_id ?? e.formId,
    campaignId: got.lead.campaign_id,
    adsetId: got.lead.adset_id,
    adId: got.lead.ad_id ?? e.adId,
    contactConsent: true, // confirmé par le propriétaire pour cette page (consent_confirmed)
    notifyTeam: page.organization_id === DEFAULT_ORG_ID,
  })
  if (r.ok) return r.duplicate ? "duplicate" : "ok"
  if (r.reason === "storage_unavailable" || r.reason === "storage_error") return "retry"
  console.error("[meta-leads] lead refusé", { leadgenId: e.leadgenId, reason: r.reason, champs: r.errors ? Object.keys(r.errors) : undefined })
  return "dropped"
}

/** GET : vérification d'abonnement Meta. Route inerte (404) tant que META_LEADS_VERIFY_TOKEN n'est pas défini. */
export function handleMetaLeadsGet(params: URLSearchParams): WebhookResult {
  const token = process.env.META_LEADS_VERIFY_TOKEN || ""
  if (!token) return { status: 404, body: "" }
  const challenge = metaChallenge(params, token)
  return challenge ? { status: 200, body: challenge, contentType: "text/plain" } : { status: 403, body: "" }
}

/** POST : événements `leadgen`. Route inerte (404) tant que META_APP_SECRET n'est pas défini. */
export async function handleMetaLeadsPost(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const secret = process.env.META_APP_SECRET || ""
  if (!secret) return { status: 404, body: "" }
  if (rawBody.length > MAX_BODY) return { status: 413, body: "" }
  if (!verifyMetaSignature(rawBody, signature, secret)) return { status: 401, body: "" }
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return { status: 400, body: "" }
  }
  const events = parseLeadgenPayload(json)
  const outcomes: Outcome[] = []
  for (const e of events) outcomes.push(await processEvent(e))
  const retry = outcomes.includes("retry")
  return { status: retry ? 500 : 200, body: JSON.stringify({ received: events.length, retry }), contentType: "application/json" }
}
