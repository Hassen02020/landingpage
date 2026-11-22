// Pilotage des canaux (lot C) — états PURS déduits de FAITS observés. Règle : un canal « connecté » n'est déclaré fonctionnel qu'après
// un événement RÉEL reçu de ce canal ; un test réussi prouve seulement que l'API accepte la requête, pas que des clients passent par là.
export type ChannelState = "not_connected" | "connected_unproven" | "receiving" | "silent" | "failing" | "degraded" | "manual"
export type ChannelId = "formulaires" | "whatsapp" | "messenger" | "instagram" | "telephone" | "meta_conversions" | "tiktok"

export interface ChannelFacts {
  configured: boolean // le canal est branché (numéro enregistré, intégration active) ; un canal de saisie manuelle l'est toujours
  manual?: boolean // canal sans réception automatique (téléphone) : alimenté par la saisie de l'équipe
  lastEventAt: string | null // dernier événement REEL reçu ou envoyé avec succès
  events7d: number
  dropped7d: number // événements reçus mais perdus (échec de rattachement, rejet)
  lastTestOk: boolean | null // dernier test d'envoi (intégrations seulement)
  lastTestAt: string | null
  lastTestMessage?: string | null // raison technique du dernier test (jamais de jeton)
}
export interface ChannelReport { id: ChannelId; label: string; state: ChannelState; headline: string; detail: string; alert: boolean }

export const SILENCE_DAYS = 7 // aucun événement depuis ce délai : le canal est « silencieux » (valeur par défaut à valider)
const DAY = 86_400_000
const ago = (iso: string | null, now: Date): string => {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(t)) return "date inconnue"
  const d = Math.floor((now.getTime() - t) / DAY)
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`
}

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  formulaires: "Landing pages et formulaires", whatsapp: "WhatsApp Business (réception)", messenger: "Facebook Messenger", instagram: "Instagram Direct",
  telephone: "Téléphone", meta_conversions: "Meta — conversions (Lead, Qualifié, Achat)", tiktok: "TikTok — événements",
}

export function channelReport(id: ChannelId, f: ChannelFacts, now: Date = new Date()): ChannelReport {
  const base = { id, label: CHANNEL_LABELS[id] }
  const last = f.lastEventAt ? Date.parse(f.lastEventAt) : null
  if (f.manual) return { ...base, state: "manual", alert: false, headline: "Saisie manuelle", detail: f.events7d > 0 ? `${f.events7d} saisie(s) sur 7 jours, dernière ${ago(f.lastEventAt, now)}.` : "Aucune saisie sur 7 jours : les appels ne sont pas comptés tant que l'équipe ne les saisit pas." }
  if (!f.configured) return { ...base, state: "not_connected", alert: false, headline: "Non connecté", detail: "Aucune intégration : ce canal n'envoie rien au CRM." }
  if (f.dropped7d > 0) return { ...base, state: "degraded", alert: true, headline: "Événements perdus", detail: `${f.dropped7d} événement(s) reçu(s) sur 7 jours n'ont pas pu être rattachés. Consultez le journal des intégrations.` }
  // Un événement RÉEL récent l'emporte sur tout test : un test « non concluant » (ex. jeton d'envoi qui ne peut pas lire le pixel) n'est pas une panne.
  if (f.events7d === 0 && last === null) {
    if (f.lastTestOk === false) return { ...base, state: "failing", alert: true, headline: "Dernier test non concluant", detail: `Le test du ${ago(f.lastTestAt, now)} n'a pas abouti${f.lastTestMessage ? ` : ${f.lastTestMessage}` : ""}. Aucun événement réel n'a jamais été reçu : fonctionnement non prouvé.` }
    return { ...base, state: "connected_unproven", alert: true, headline: "Connecté, fonctionnement non prouvé", detail: f.lastTestOk === true ? `Un test a réussi (${ago(f.lastTestAt, now)}) mais aucun événement réel n'a jamais été reçu : l'API accepte les requêtes, rien ne prouve que des clients passent par ce canal.` : "Aucun événement réel n'a jamais été reçu." }
  }
  if (last !== null && now.getTime() - last > SILENCE_DAYS * DAY) return { ...base, state: "silent", alert: true, headline: "Silencieux", detail: `Dernier événement ${ago(f.lastEventAt, now)} : plus rien depuis plus de ${SILENCE_DAYS} jours.` }
  return { ...base, state: "receiving", alert: false, headline: "Reçoit des événements", detail: `${f.events7d} événement(s) sur 7 jours, dernier ${ago(f.lastEventAt, now)}.` }
}

export const STATE_LABELS: Record<ChannelState, string> = {
  not_connected: "Non connecté", connected_unproven: "Non prouvé", receiving: "Fonctionne", silent: "Silencieux", failing: "En échec", degraded: "Dégradé", manual: "Manuel",
}
