"use server"

// Équipe, modèles de messages et mot de passe personnel.
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { AT_COOKIE, currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { rateLimited } from "@/lib/server/guard"
import { addMember, changeOwnPassword, resetMemberPassword, updateMember } from "@/lib/server/team"
import { saveTemplate } from "@/lib/server/templates"

export interface TeamState {
  ok?: boolean
  message?: string
  password?: string // mot de passe provisoire, affiché une seule fois
  errors?: Record<string, string>
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()

async function requireAdmin() {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "employees.manage")) return null
  if (rateLimited(`team:${staff.userId}`, 60, 10 * 60 * 1000)) return null
  return { staff, actor: { id: staff.userId, label: staff.email } }
}
const DENIED: TeamState = { ok: false, message: "Réservé aux administrateurs (ou trop de modifications : réessayez plus tard)." }

export async function addMemberAction(_p: TeamState | undefined, fd: FormData): Promise<TeamState> {
  const a = await requireAdmin()
  if (!a) return DENIED
  try {
    const res = await addMember({ email: field(fd, "email"), fullName: field(fd, "full_name"), role: field(fd, "role") }, a.actor)
    if (!res.ok) return { ok: false, message: res.error }
    revalidatePath("/admin/equipe")
    return res.password
      ? { ok: true, message: `Compte créé pour ${res.email}. Transmettez-lui ce mot de passe provisoire (affiché une seule fois) :`, password: res.password }
      : { ok: true, message: `${res.email} avait déjà un compte : il est ajouté à l'équipe avec son mot de passe actuel.` }
  } catch {
    return { ok: false, message: "Ajout impossible (migration 0005 appliquée ?)." }
  }
}

export async function updateMemberAction(fd: FormData): Promise<void> {
  const a = await requireAdmin()
  if (!a) return
  const what = field(fd, "what")
  const patch = what === "role" ? { role: field(fd, "role") } : what === "active" ? { active: field(fd, "active") === "true" } : {}
  await updateMember(field(fd, "user_id"), patch, a.actor).catch(() => undefined)
  revalidatePath("/admin/equipe")
}

export async function resetPasswordAction(_p: TeamState | undefined, fd: FormData): Promise<TeamState> {
  const a = await requireAdmin()
  if (!a) return DENIED
  const res = await resetMemberPassword(field(fd, "user_id"), a.actor).catch(() => ({ ok: false as const, error: "Échec." }))
  if (!res.ok) return { ok: false, message: res.error }
  return { ok: true, message: "Nouveau mot de passe provisoire (affiché une seule fois) :", password: res.password }
}

export async function saveTemplateAction(_p: TeamState | undefined, fd: FormData): Promise<TeamState> {
  const a = await requireAdmin()
  if (!a) return DENIED
  const f: Record<string, string> = {}
  fd.forEach((v, k) => {
    if (typeof v === "string") f[k] = v
  })
  try {
    const res = await saveTemplate(f.id || null, f, a.actor)
    if (!res.ok) return { ok: false, errors: res.errors, message: "Vérifiez les champs signalés." }
  } catch {
    return { ok: false, message: "Enregistrement impossible (migration 0005 appliquée ?)." }
  }
  revalidatePath("/admin/modeles")
  return { ok: true, message: "Modèle enregistré." }
}

/** Tout membre connecté : changer son mot de passe. */
export async function changePasswordAction(_p: TeamState | undefined, fd: FormData): Promise<TeamState> {
  const staff = await currentStaff()
  if (!staff) return { ok: false, message: "Session expirée : reconnectez-vous." }
  if (rateLimited(`password:${staff.userId}`, 5, 15 * 60 * 1000)) return { ok: false, message: "Trop de tentatives. Réessayez plus tard." }
  const p1 = String(fd.get("password") ?? "")
  const p2 = String(fd.get("confirm") ?? "")
  if (p1 !== p2) return { ok: false, message: "Les deux mots de passe ne correspondent pas." }
  const token = cookies().get(AT_COOKIE)?.value
  if (!token) return { ok: false, message: "Session expirée : reconnectez-vous." }
  const res = await changeOwnPassword(token, p1)
  return res.ok ? { ok: true, message: "Mot de passe modifié." } : { ok: false, message: res.error }
}
