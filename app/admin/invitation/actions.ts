"use server"

import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { changeOwnPassword } from "@/lib/server/team"

/** Le jeton d'invitation (Supabase) est vérifié auprès de Supabase ; seul son propriétaire peut choisir un mot de passe. */
export async function acceptInvitationAction(_p: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const token = String(fd.get("token") ?? "")
  const password = String(fd.get("password") ?? "")
  const again = String(fd.get("again") ?? "")
  if (!token) return { error: "Lien d'invitation invalide ou expiré. Demandez une nouvelle invitation." }
  if (password !== again) return { error: "Les deux mots de passe ne sont pas identiques." }
  const user = await getAuthUser(token)
  if (!user) return { error: "Lien d'invitation invalide ou expiré. Demandez une nouvelle invitation." }
  if (rateLimited(`invite:${user.id}`, 10, 15 * 60 * 1000)) return { error: "Trop de tentatives. Réessayez dans quelques minutes." }
  const res = await changeOwnPassword(token, password)
  if (!res.ok) return { error: res.error }
  redirect("/admin/login?ok=mot-de-passe")
}
