// VÉRIFICATION RÉELLE d'une destination avant de déclarer un lien « prêt » : une requête GET vers NOTRE PROPRE site, SANS suivre les redirections.
//  200 → ok ; 3xx → la page redirige (pas prête) ; 404 → introuvable ; 5xx → erreur du site ; délai dépassé / réseau → « non vérifié » (≠ indisponible).
// La destination est validée contre la liste reconstruite côté serveur (jamais une adresse libre venue du navigateur) : aucune requête vers un autre domaine.
import { SITE_URL } from "@/lib/config"

export type LinkCheckState = "ok" | "redirect" | "not_found" | "error" | "timeout" | "unverified" | "refused"
export interface LinkCheck { state: LinkCheckState; status?: number; location?: string; checkedUrl: string; message: string; at: string }

/** Origine testée : le site public (SITE_URL) ; surchargeable côté serveur pour les essais locaux (LANDING_LINK_CHECK_ORIGIN, optionnelle). */
export const checkOrigin = (): string => (process.env.LANDING_LINK_CHECK_ORIGIN || SITE_URL).replace(/\/$/, "")

const TEXT: Record<LinkCheckState, string> = {
  ok: "La page répond (HTTP 200).",
  redirect: "La page redirige ailleurs : le lien n'est pas prêt.",
  not_found: "La page est introuvable (HTTP 404).",
  error: "Le site renvoie une erreur (HTTP 5xx).",
  timeout: "Pas de réponse dans le délai : non vérifié (cela ne prouve pas que la page est en panne).",
  unverified: "Vérification impossible depuis le serveur : non vérifié.",
  refused: "Destination inconnue : aucune requête envoyée.",
}

export async function checkDestination(path: string, allowed: string[], opts: { origin?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<LinkCheck> {
  const origin = (opts.origin ?? checkOrigin()).replace(/\/$/, "")
  const at = new Date().toISOString()
  const checkedUrl = `${origin}${path}`
  const out = (state: LinkCheckState, extra: Partial<LinkCheck> = {}): LinkCheck => ({ state, checkedUrl, at, message: TEXT[state], ...extra })
  if (!allowed.includes(path) || !/^\/[A-Za-z0-9/_-]*$/.test(path) || path.includes("//")) return out("refused")
  try {
    const res = await (opts.fetchImpl ?? fetch)(checkedUrl, {
      method: "GET", redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      headers: { "user-agent": "Easy2Book-LinkCheck/1", "cache-control": "no-cache" },
    })
    const status = res.status
    if (status === 200) return out("ok", { status })
    if (status >= 300 && status < 400) return out("redirect", { status, location: res.headers.get("location") ?? undefined })
    if (status === 404) return out("not_found", { status })
    if (status >= 500) return out("error", { status })
    return out("error", { status, message: `Réponse inattendue (HTTP ${status}).` })
  } catch (e) {
    const name = (e as { name?: string }).name
    return out(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unverified")
  }
}
