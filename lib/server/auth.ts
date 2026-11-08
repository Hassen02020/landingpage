// Connexion de l'équipe à /admin via Supabase Auth (projet landing), par l'API REST :
// aucune dépendance npm. Les jetons sont gardés en cookies httpOnly ; chaque page
// vérifie le jeton auprès de Supabase PUIS l'appartenance à landing_staff.
import { cookies } from "next/headers"
import { runWithOrg, select } from "./db"
import { resolveMembership } from "./tenant"
import { roleFromLegacyStaff, type OrgRole } from "@/lib/permissions"

export const AT_COOKIE = "e2b_admin_at"
export const RT_COOKIE = "e2b_admin_rt"

export interface Staff {
  userId: string
  email: string
  fullName: string | null
  role: "admin" | "agent"
  organizationId: string | null // organisation du compte (organization_members) ; null : schéma d'avant 0008
  orgRole: OrgRole
}

function authConfig() {
  const url = process.env.LANDING_SUPABASE_URL
  const key = process.env.LANDING_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ""), key }
}

export function authConfigured(): boolean {
  return authConfig() !== null
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user?: { id: string; email?: string }
}

async function tokenRequest(grant: "password" | "refresh_token", body: Record<string, string>): Promise<TokenResponse | null> {
  const cfg = authConfig()
  if (!cfg) return null
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as TokenResponse
}

export const signInWithPassword = (email: string, password: string) => tokenRequest("password", { email, password })
export const refreshSession = (refreshToken: string) => tokenRequest("refresh_token", { refresh_token: refreshToken })

/** Vérifie le jeton auprès de Supabase (signature, expiration, révocation). */
export async function getAuthUser(accessToken: string): Promise<{ id: string; email: string } | null> {
  const cfg = authConfig()
  if (!cfg || !accessToken) return null
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string; email?: string }
  return user.id ? { id: user.id, email: user.email ?? "" } : null
}

export async function signOut(accessToken: string): Promise<void> {
  const cfg = authConfig()
  if (!cfg || !accessToken) return
  await fetch(`${cfg.url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => {})
}

/** Membre actif de l'équipe pour ce compte, ou null. */
export async function findStaff(userId: string): Promise<Staff | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  // L'organisation du compte vient de organization_members (table non cloisonnée) ; la fiche d'équipe est ensuite lue DANS cette organisation.
  const m = await resolveMembership(userId).catch(() => null)
  const read = () =>
    select<{ user_id: string; email: string; full_name: string | null; role: "admin" | "agent" }>(
      "landing_staff",
      `select=user_id,email,full_name,role&user_id=eq.${userId}&active=eq.true&limit=1`
    )
  const rows = await (m ? Promise.resolve(runWithOrg(m.organizationId, read)) : read()).catch(() => [])
  const s = rows[0]
  return s
    ? { userId: s.user_id, email: s.email, fullName: s.full_name, role: s.role, organizationId: m?.organizationId ?? null, orgRole: m?.role ?? roleFromLegacyStaff(s.role) }
    : null
}

/** Utilisateur connecté ET membre actif de l'équipe, d'après les cookies de la requête. */
export async function currentStaff(): Promise<Staff | null> {
  const token = cookies().get(AT_COOKIE)?.value
  if (!token) return null
  const user = await getAuthUser(token)
  if (!user) return null
  return findStaff(user.id)
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
})

/** Lit l'expiration d'un JWT sans le vérifier (sert seulement à décider d'un rafraîchissement). */
export function jwtExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}
