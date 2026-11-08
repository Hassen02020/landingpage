// Organisation du compte connecté (cookies de la requête) : utilisée par db.ts en mode multi-entreprises quand aucun
// contexte explicite n'est posé (pages admin, actions, routes d'administration). Les points d'entrée PUBLICS posent
// toujours un contexte explicite (withPublicOrg), qui passe avant la session.
import { cookies } from "next/headers"
import { AT_COOKIE, getAuthUser } from "./auth"
import { resolveMembership } from "./tenant"

const TTL_MS = 30_000
const MAX_ENTRIES = 500
const memo = new Map<string, { at: number; org: string | null }>()

export function resetSessionOrgCache(): void {
  memo.clear()
}

/** Organisation du compte connecté, ou null (pas de session, jeton invalide, pas de membre actif, organisation suspendue, ambiguïté). */
export async function resolveSessionOrg(): Promise<string | null> {
  let token: string | undefined
  try {
    token = cookies().get(AT_COOKIE)?.value
  } catch {
    return null // hors requête (génération statique, tâche de fond) : aucun compte
  }
  if (!token) return null
  const hit = memo.get(token)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.org
  const user = await getAuthUser(token) // vérifie signature, expiration, révocation auprès de Supabase
  const m = user ? await resolveMembership(user.id).catch(() => null) : null
  const org = m?.organizationId ?? null
  if (memo.size >= MAX_ENTRIES) memo.delete(memo.keys().next().value as string)
  memo.set(token, { at: Date.now(), org })
  return org
}
