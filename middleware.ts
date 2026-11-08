import { NextRequest, NextResponse } from "next/server"

// Rafraîchit la session de l'équipe sur /admin avant expiration du jeton.
// La VÉRIFICATION (jeton valide + membre de l'équipe) est faite par chaque page côté serveur.
const AT = "e2b_admin_at"
const RT = "e2b_admin_rt"

function expiresAt(token: string | undefined): number | null {
  if (!token) return null
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4))) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function toLogin(request: NextRequest) {
  const url = new URL("/admin/login", request.url)
  url.searchParams.set("next", request.nextUrl.pathname)
  const res = NextResponse.redirect(url)
  res.cookies.delete(AT)
  res.cookies.delete(RT)
  return res
}

export async function middleware(request: NextRequest) {
  // pages publiques de l'espace : connexion, et acceptation d'une invitation (le jeton d'invitation est dans le fragment d'URL)
  if (request.nextUrl.pathname.startsWith("/admin/login") || request.nextUrl.pathname.startsWith("/admin/invitation")) return NextResponse.next()

  const at = request.cookies.get(AT)?.value
  const rt = request.cookies.get(RT)?.value
  if (!at && !rt) return toLogin(request)

  const exp = expiresAt(at)
  if (at && exp && exp - Date.now() > 60_000) return NextResponse.next()
  if (!rt) return toLogin(request)

  const url = process.env.LANDING_SUPABASE_URL
  const key = process.env.LANDING_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return toLogin(request)

  const r = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
    cache: "no-store",
  }).catch(() => null)
  if (!r || !r.ok) return toLogin(request)
  const session = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number }

  // nouveaux jetons visibles dès cette requête (pages serveur) et enregistrés dans le navigateur
  request.cookies.set(AT, session.access_token)
  request.cookies.set(RT, session.refresh_token)
  const res = NextResponse.next({ request: { headers: request.headers } })
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" }
  res.cookies.set(AT, session.access_token, { ...opts, maxAge: session.expires_in })
  res.cookies.set(RT, session.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 30 })
  return res
}

export const config = { matcher: ["/admin/:path*"] }
