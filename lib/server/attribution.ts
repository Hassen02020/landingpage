// Nettoie les données d'attribution envoyées par le navigateur (non fiables) et
// les aplatit en colonnes pour Supabase / le CRM.

// Caractères de contrôle (dont le caractère nul, refusé par PostgreSQL) et de sens d'écriture / zéro-largeur
// (inversion d'affichage dans le CRM) : retirés de toute chaîne reçue d'un visiteur. Les retours à la ligne et tabulations restent.
// eslint-disable-next-line no-control-regex
const HIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g
export const stripHiddenChars = (v: string): string => v.replace(HIDDEN_CHARS, "")

const str = (v: unknown, max = 255): string | undefined => {
  if (typeof v !== "string") return undefined
  const s = stripHiddenChars(v).trim()
  return s ? s.slice(0, max) : undefined
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {})

export interface FlatAttribution {
  visitor_id?: string
  ref?: string
  channel?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  fbclid?: string
  ttclid?: string
  gclid?: string
  first_channel?: string
  first_utm_source?: string
  first_utm_campaign?: string
  landing_page?: string
  page_url?: string
  referrer?: string
  fbp?: string
  fbc?: string
  ttp?: string
}

export function flattenAttribution(raw: unknown): FlatAttribution {
  const a = obj(raw)
  const last = obj(a.last_touch)
  const first = obj(a.first_touch)
  // le dernier contact porteur de paramètres de campagne fait foi ; sinon le premier
  const t = Object.keys(last).length ? last : first
  const ref = str(a.ref, 16)
  return {
    visitor_id: str(a.visitor_id, 64),
    ref: ref && /^E2B-[A-Z0-9]{6}$/.test(ref) ? ref : undefined,
    channel: str(t.channel, 32),
    utm_source: str(t.utm_source),
    utm_medium: str(t.utm_medium),
    utm_campaign: str(t.utm_campaign),
    utm_content: str(t.utm_content),
    utm_term: str(t.utm_term),
    ad_id: str(t.ad_id, 64),
    adset_id: str(t.adset_id, 64),
    campaign_id: str(t.campaign_id, 64),
    fbclid: str(t.fbclid ?? first.fbclid, 500),
    ttclid: str(t.ttclid ?? first.ttclid, 500),
    gclid: str(t.gclid ?? first.gclid, 500),
    first_channel: str(first.channel, 32),
    first_utm_source: str(first.utm_source),
    first_utm_campaign: str(first.utm_campaign),
    landing_page: str(t.landing_page ?? first.landing_page),
    page_url: str(a.page_url, 1000),
    referrer: str(a.referrer, 1000),
    fbp: str(a.fbp, 200),
    fbc: str(a.fbc, 500),
    ttp: str(a.ttp, 200),
  }
}

export { str, obj }
