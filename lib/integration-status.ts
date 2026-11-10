// État de la mesure d'une intégration publicitaire, affiché en haut de chaque carte de /admin/integrations.
// Fonction pure (testable) : ne reçoit que ce que l'écran sait déjà, jamais de jeton.
export interface StatusInput {
  provider: "meta" | "tiktok"
  enabled: boolean
  pixelId: string
  pixelSource: string // "admin" | "vercel" | "none"
  tokenSource: string // "admin" | "vercel" | "none"
  tokenUnreadable: boolean
  testEventCode: string
}

export type StatusLevel = "ok" | "warn" | "off"
export interface MeasurementStatus {
  level: StatusLevel
  title: string
  detail: string
}

export function measurementStatus(i: StatusInput): MeasurementStatus {
  const name = i.provider === "meta" ? "Meta" : "TikTok"
  const hasPixel = i.pixelSource !== "none"
  const hasToken = i.tokenSource !== "none" && !i.tokenUnreadable

  if (!i.enabled) {
    return { level: "off", title: "Mesure désactivée", detail: `Aucun événement n'est envoyé à ${name}. Cochez « Activer cette intégration » puis Enregistrer.` }
  }
  if (!hasPixel) {
    return { level: "warn", title: "ID du pixel manquant", detail: `Renseignez l'ID du pixel ${name} : sans lui, rien n'est mesuré.` }
  }
  if (i.testEventCode.trim()) {
    return {
      level: "warn",
      title: "Mode test actif : vos événements réels ne comptent pas",
      detail: "Un code de test est enregistré. Videz le champ « Code de test » puis Enregistrer, sinon les conversions n'apparaissent que dans l'outil de test.",
    }
  }
  if (i.tokenUnreadable) {
    return { level: "warn", title: "Jeton illisible", detail: "Le jeton enregistré ne peut pas être lu : ressaisissez-le. Le pixel du navigateur reste actif." }
  }
  if (!hasToken) {
    return { level: "warn", title: "Pixel navigateur seul", detail: `Le pixel ${name} est actif, mais l'envoi depuis le serveur est coupé faute de jeton. Ajoutez le jeton pour mesurer aussi les visiteurs qui bloquent les traceurs.` }
  }
  return {
    level: "ok",
    title: "Mesure active",
    detail: `Le pixel du navigateur et l'envoi serveur sont actifs pour les visiteurs qui ont accepté le bandeau. Les doublons sont écartés par ${name}.`,
  }
}
