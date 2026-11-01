// Consentement aux traceurs publicitaires (Meta Pixel, TikTok Pixel, API serveur).
// Règle : AUCUN traceur tiers n'est chargé et AUCUN événement n'est transmis à Meta ou
// TikTok tant que le visiteur n'a pas cliqué sur « Accepter » (opt-in).

export type ConsentState = "granted" | "denied"

export const CONSENT_KEY = "e2b_consent"
export const CONSENT_EVENT = "e2b:consent"

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    if (v === "granted" || v === "denied") return v
  } catch {
    /* stockage indisponible */
  }
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )e2b_consent=(granted|denied)/) : null
  return m ? (m[1] as ConsentState) : null
}

export function hasTrackingConsent(): boolean {
  return getConsent() === "granted"
}

export function setConsent(state: ConsentState): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, state)
  } catch {
    /* ignore */
  }
  const expires = new Date(Date.now() + 180 * 864e5).toUTCString()
  document.cookie = `${CONSENT_KEY}=${state}; expires=${expires}; path=/; SameSite=Lax`
  if (state === "denied") {
    // retrait du consentement : suppression des identifiants publicitaires posés par le site
    for (const name of ["_fbc", "_fbp", "_ttp", "e2b_vid"]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
    try {
      window.localStorage.removeItem("e2b_vid")
      window.localStorage.removeItem("e2b_ft")
      window.localStorage.removeItem("e2b_lt")
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }))
}
