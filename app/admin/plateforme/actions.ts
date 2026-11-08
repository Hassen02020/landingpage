"use server"

import { revalidatePath } from "next/cache"
import { rateLimited } from "@/lib/server/guard"
import { createOrganization, currentPlatformAdmin, setOrganizationStatus } from "@/lib/server/platform"

export interface PlatformState {
  ok?: boolean
  message?: string
}
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()

async function requireSuperAdmin() {
  const actor = await currentPlatformAdmin()
  if (!actor || rateLimited(`platform:${actor.userId}`, 30, 10 * 60 * 1000)) return null
  return actor
}
const DENIED: PlatformState = { ok: false, message: "Réservé au Super Admin (ou trop de modifications : réessayez plus tard)." }

export async function createOrganizationAction(_p: PlatformState | undefined, fd: FormData): Promise<PlatformState> {
  const actor = await requireSuperAdmin()
  if (!actor) return DENIED
  const res = await createOrganization(
    { name: field(fd, "name"), slug: field(fd, "slug"), sector: field(fd, "sector"), adminEmail: field(fd, "admin_email"), adminName: field(fd, "admin_name") },
    actor
  ).catch(() => ({ ok: false as const, error: "Création impossible pour le moment." }))
  if (!res.ok) return { ok: false, message: res.error }
  revalidatePath("/admin/plateforme")
  return {
    ok: true,
    message: res.invited
      ? `Entreprise « ${res.slug} » créée. Une invitation a été envoyée à ${res.email} : le premier administrateur choisit son mot de passe depuis le lien reçu.`
      : `Entreprise « ${res.slug} » créée. ${res.email} avait déjà un compte : aucune invitation envoyée, il se connecte avec son mot de passe actuel.`,
  }
}

export async function setStatusAction(fd: FormData): Promise<void> {
  const actor = await requireSuperAdmin()
  if (!actor) return
  const status = field(fd, "status") === "suspended" ? "suspended" : "active"
  await setOrganizationStatus(field(fd, "id"), status, actor).catch(() => undefined)
  revalidatePath("/admin/plateforme")
}
