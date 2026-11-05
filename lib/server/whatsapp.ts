// WhatsApp côté CRM : rattacher un message reçu à son origine (clic, publicité, page) grâce à la
// référence « Réf: E2B-XXXXXX » que le site ajoute au message. Aucune API WhatsApp n'est connectée :
// tout ce qui n'est pas observable (message réellement envoyé ou reçu) est SAISI par l'équipe.
import { select } from "./db"

export const WA_REF_RE = /E2B-[A-Z0-9]{6}/i

/** Extrait la référence d'un texte collé (message entier ou référence seule), en majuscules. */
export function parseWaRef(text: string | undefined | null): string | null {
  const m = WA_REF_RE.exec(text ?? "")
  return m ? m[0].toUpperCase() : null
}

export interface ClickRow {
  created_at: string
  location: string | null
  product: string | null
  offer: string | null
  niche: string | null
  channel: string | null
  utm_source: string | null
  utm_campaign: string | null
  utm_content: string | null
  ad_id: string | null
}

export interface Conversation {
  ref: string
  lead: { id: string; ref: string; first_name: string; status: string; anonymized_at: string | null } | null
  clicks: ClickRow[] // du plus récent au plus ancien
}

/** Retrouve le lead (même référence, ou même visiteur) et les clics WhatsApp enregistrés pour cette référence. */
export async function lookupConversation(ref: string): Promise<Conversation> {
  const cols = "id,ref,first_name,status,anonymized_at"
  const byRef = await select<NonNullable<Conversation["lead"]>>("landing_leads", `select=${cols}&ref=eq.${ref}&limit=1`)
  const lead = byRef[0] ?? (await select<NonNullable<Conversation["lead"]>>("landing_leads", `select=${cols}&visitor_ref=eq.${ref}&limit=1`))[0] ?? null
  const clicks = await select<ClickRow>(
    "landing_events",
    `select=created_at,location,product,offer,niche,channel,utm_source,utm_campaign,utm_content,ad_id&visitor_ref=eq.${ref}&event_name=eq.Contact&order=created_at.desc&limit=20`
  ).catch(() => [])
  return { ref, lead, clicks }
}

const fr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" }).format(new Date(iso))

/** Phrase d'historique décrivant ce que l'on a (ou non) retrouvé : jamais d'affirmation sans preuve. */
export function describeAttachment(c: Conversation): string {
  if (!c.clicks.length) return `Message WhatsApp reçu (réf. ${c.ref}) — aucun clic retrouvé (visiteur sans accord aux traceurs, ou message ancien) : origine inconnue`
  const k = c.clicks[0]
  const extra = [k.utm_source && `source ${k.utm_source}`, k.utm_campaign && `campagne ${k.utm_campaign}`].filter(Boolean).join(", ")
  return `Message WhatsApp reçu (réf. ${c.ref}) — rattaché au clic du ${fr(k.created_at)} (bouton « ${k.location ?? "?"} »${extra ? `, ${extra}` : ""})`
}
