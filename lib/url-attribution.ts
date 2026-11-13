// Attribution lue dans l'ADRESSE de la page au moment de l'envoi d'un formulaire (pages d'entreprise /o/<entreprise>, qui n'ont ni bandeau de consentement ni suivi).
// Fonction PURE : ne lit que ce qui est passé en paramètre, ne stocke rien dans le navigateur.
// Seuls des paramètres de CAMPAGNE (UTM, identifiants de campagne / groupe / annonce) sont transmis ; les identifiants de clic (fbclid, ttclid, gclid) ne sont JAMAIS envoyés
// (ils servent uniquement à reconnaître le canal), car ces pages n'ont pas de consentement aux traceurs.
import { detectChannel } from "./channel"

const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ad_id", "adset_id", "campaign_id"] as const

export interface UrlTouch {
  channel: string
  landing_page: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  ad_id?: string
  adset_id?: string
  campaign_id?: string
}

export function touchFromUrl(search: string, pathname: string, referrer = ""): UrlTouch {
  const params = new URLSearchParams(search)
  const touch: UrlTouch = { channel: detectChannel(params, referrer), landing_page: pathname }
  for (const k of CAMPAIGN_KEYS) {
    const v = params.get(k)
    if (v) touch[k] = v.slice(0, 255)
  }
  return touch
}

/** Objet `attribution` du formulaire /o : adresse, page d'arrivée et dernier / premier contact tirés de l'adresse. */
export function attributionFromUrl(href: string, pathname: string, search: string, referrer = "") {
  const touch = touchFromUrl(search, pathname, referrer)
  return { page_url: href, landing_page: pathname, last_touch: touch, first_touch: touch }
}
