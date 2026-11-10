"use server"

import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { saveMetaPage } from "@/lib/server/meta-pages"

export interface MetaPageFormState { ok?: boolean; message?: string; errors?: Record<string, string> }

export async function saveMetaPageAction(_prev: MetaPageFormState | undefined, fd: FormData): Promise<MetaPageFormState> {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "social.connect") || !staff.organizationId) return { ok: false, message: "Réservé aux administrateurs." }
  if (rateLimited(`meta-pages:${staff.userId}`, 20, 10 * 60 * 1000)) return { ok: false, message: "Trop de modifications. Réessayez dans quelques minutes." }
  const res = await saveMetaPage(staff.organizationId, staff.userId, {
    pageId: String(fd.get("pageId") ?? ""),
    pageName: String(fd.get("pageName") ?? ""),
    token: String(fd.get("token") ?? ""),
    enabled: fd.get("enabled") === "on",
    consentConfirmed: fd.get("consentConfirmed") === "on",
  })
  if (!res.ok) return { ok: false, errors: res.errors, message: res.message }
  revalidatePath("/admin/integrations")
  return { ok: true, message: "Enregistré. Pris en compte par le site en moins d'une minute." }
}
