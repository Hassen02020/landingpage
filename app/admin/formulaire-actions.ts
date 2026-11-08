"use server"

import { revalidatePath } from "next/cache"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { can } from "@/lib/permissions"
import { MAX_CUSTOM_FIELDS, STANDARD_FIELDS, validateFormConfigInput } from "@/lib/form-config"
import { saveFormConfig } from "@/lib/server/org-public"

export interface FormConfigState {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
}

const on = (fd: FormData, k: string) => fd.get(k) === "on"
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "")

export async function saveFormConfigAction(_p: FormConfigState | undefined, fd: FormData): Promise<FormConfigState> {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "site.manage") || rateLimited(`formcfg:${staff.userId}`, 30, 10 * 60 * 1000)) {
    return { ok: false, message: "Réservé aux administrateurs (ou trop de modifications : réessayez plus tard)." }
  }
  const fields = Object.fromEntries(STANDARD_FIELDS.map((k) => [k, { enabled: on(fd, `f_${k}_enabled`), required: on(fd, `f_${k}_required`) }]))
  const custom = Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => ({ label: text(fd, `custom_${i + 1}_label`), required: on(fd, `custom_${i + 1}_required`) }))
  const res = validateFormConfigInput({ fields, custom, title: text(fd, "title"), intro: text(fd, "intro"), thanks: text(fd, "thanks") })
  if (!res.config) return { ok: false, message: "Corrigez les champs signalés.", errors: res.errors }
  const saved = await saveFormConfig(res.config, staff.userId)
  if (!saved.ok) return { ok: false, message: saved.error }
  revalidatePath("/admin/formulaire")
  return { ok: true, message: "Formulaire enregistré. Les nouveaux visiteurs le voient tout de suite." }
}
