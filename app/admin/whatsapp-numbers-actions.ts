"use server"

import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { saveWhatsAppNumber } from "@/lib/server/whatsapp-numbers"

export interface WhatsAppNumberFormState { ok?: boolean; message?: string; errors?: Record<string, string> }

export async function saveWhatsAppNumberAction(_prev: WhatsAppNumberFormState | undefined, fd: FormData): Promise<WhatsAppNumberFormState> {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "social.connect") || !staff.organizationId) return { ok: false, message: "Réservé aux administrateurs." }
  if (rateLimited(`wa-numbers:${staff.userId}`, 20, 10 * 60 * 1000)) return { ok: false, message: "Trop de modifications. Réessayez dans quelques minutes." }
  const res = await saveWhatsAppNumber(staff.organizationId, staff.userId, {
    phoneNumberId: String(fd.get("phoneNumberId") ?? ""),
    displayPhone: String(fd.get("displayPhone") ?? ""),
    enabled: fd.get("enabled") === "on",
  })
  if (!res.ok) return { ok: false, errors: res.errors, message: res.message }
  revalidatePath("/admin/integrations")
  return { ok: true, message: "Enregistré." }
}
