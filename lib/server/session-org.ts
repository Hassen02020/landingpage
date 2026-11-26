// Organisation du compte connecté (cookies de la requête) : utilisée par db.ts en mode multi-entreprises quand aucun
// contexte explicite n'est posé (pages admin, actions, routes d'administration). Les points d'entrée PUBLICS posent
// toujours un contexte explicite (withPublicOrg), qui passe avant la session.
import { AsyncLocalStorage } from "node:async_hooks"
import { cookies } from "next/headers"
import { AT_COOKIE, getAuthUser } from "./auth"
import { resolveMembership } from "./tenant"
import { select } from "./db"
import { roleFromLegacyStaff } from "@/lib/permissions"

const TTL_MS = 30_000
const MAX_ENTRIES = 500
// Requêtes simultanées d'un même jeton : une seule vérification. La résolution marque son propre contexte (`resolving`) : les lectures
// qu'elle fait elle-même (fiche d'équipe) repassent par db.ts et ne doivent pas redemander la session (pas de ré-entrée).
const inflight = new Map<string, Promise<Entry>>()
const resolving = new AsyncLocalStorage<true>()
type Entry = { at: number; org: string | null; userId: string | null; role: string | null }
const memo = new Map<string, Entry>()

export function resetSessionOrgCache(): void {
  memo.clear()
}

async function resolveSession(): Promise<Entry | null> {
  if (resolving.getStore()) return null
  let token: string | undefined
  try {
    token = cookies().get(AT_COOKIE)?.value
  } catch {
    return null // hors requête (génération statique, tâche de fond) : aucun compte
  }
  if (!token) return null
  const hit = memo.get(token)
  if (hit && Date.now() - hit.at < TTL_MS) return hit
  const running = inflight.get(token)
  if (running) return running
  const p = Promise.resolve(resolving.run(true, () => resolveFresh(token)))
  inflight.set(token, p)
  try {
    return await p
  } finally {
    inflight.delete(token)
  }
}

async function resolveFresh(token: string): Promise<Entry> {
  const user = await getAuthUser(token) // vérifie signature, expiration, révocation auprès de Supabase
  const m = user ? await resolveMembership(user.id).catch(() => null) : null
  let role: string | null = m?.role ?? null
  if (user && !m) {
    // schéma d'avant les organisations : le rôle vient de l'équipe actuelle (admin, manager, agent → employé)
    const rows = await select<{ role: string }>("landing_staff", `select=role&user_id=eq.${user.id}&active=eq.true&limit=1`).catch(() => [])
    if (rows[0]) role = roleFromLegacyStaff(rows[0].role)
  }
  const entry = { at: Date.now(), org: m?.organizationId ?? null, userId: user?.id ?? null, role }
  if (memo.size >= MAX_ENTRIES) memo.delete(memo.keys().next().value as string)
  memo.set(token, entry)
  return entry
}

/** Organisation du compte connecté, ou null (pas de session, jeton invalide, pas de membre actif, organisation suspendue, ambiguïté). */
export async function resolveSessionOrg(): Promise<string | null> {
  return (await resolveSession())?.org ?? null
}

/**
 * Compte EMPLOYÉ connecté (décision Q8-A) : renvoie son identifiant, sinon null (pas de session, ou rôle manager / admin).
 * Sert à restreindre côté SERVEUR toute lecture de leads à ses dossiers actuellement affectés.
 */
export async function resolveEmployeeScope(): Promise<string | null> {
  const s = await resolveSession()
  return s && s.userId && s.role === "employee" ? s.userId : null
}
