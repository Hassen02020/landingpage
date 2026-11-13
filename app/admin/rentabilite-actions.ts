"use server"

import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { runWithOrg } from "@/lib/server/db"
import { addAdSpend, voidAdSpend } from "@/lib/server/ad-spend"
import { commitCommissionImport, confirmCommissions, previewCommissionImport, type CommitResult, type PreviewResult } from "@/lib/server/commissions"
import { MAX_IMPORT_BYTES } from "@/lib/commission-import"

export interface SpendFormState { ok?: boolean; message?: string; errors?: Record<string, string> }

async function manager() {
  const staff = await currentStaff()
  if (!staff || !staff.organizationId || !can(staff.orgRole, "ads.manage")) return null
  return staff as typeof staff & { organizationId: string }
}

export async function addSpendAction(_prev: SpendFormState | undefined, fd: FormData): Promise<SpendFormState> {
  const staff = await manager()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  if (rateLimited(`ads-spend:${staff.userId}`, 60, 10 * 60 * 1000)) return { ok: false, message: "Trop de saisies. Réessayez dans quelques minutes." }
  const res = await runWithOrg(staff.organizationId, () =>
    addAdSpend({
      date: String(fd.get("date") ?? ""),
      network: String(fd.get("network") ?? ""),
      campaign: String(fd.get("campaign") ?? ""),
      amount: String(fd.get("amount") ?? ""),
      reference: String(fd.get("reference") ?? ""),
    }, staff.userId),
  )
  if (!res.ok) return { ok: false, errors: res.errors, message: res.message }
  revalidatePath("/admin/rentabilite")
  return { ok: true, message: "Dépense enregistrée." }
}

export async function voidSpendAction(id: number): Promise<{ ok: boolean; message?: string }> {
  const staff = await manager()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  if (rateLimited(`ads-void:${staff.userId}`, 30, 10 * 60 * 1000)) return { ok: false, message: "Trop d'annulations. Réessayez plus tard." }
  const res = await runWithOrg(staff.organizationId, () => voidAdSpend(Number(id), staff.userId))
  if (!res.ok) return { ok: false, message: res.message }
  revalidatePath("/admin/rentabilite")
  return { ok: true }
}

export async function previewImportAction(csv: string): Promise<PreviewResult | { fatal: string }> {
  const staff = await manager()
  if (!staff) return { fatal: "Réservé aux administrateurs." }
  if (typeof csv !== "string" || csv.length > MAX_IMPORT_BYTES) return { fatal: "Fichier trop volumineux." }
  if (rateLimited(`ads-preview:${staff.userId}`, 30, 10 * 60 * 1000)) return { fatal: "Trop de tentatives. Réessayez plus tard." }
  return runWithOrg(staff.organizationId, () => previewCommissionImport(csv))
}

export async function commitImportAction(csv: string, validatedKeys: string[]): Promise<CommitResult | { fatal: string }> {
  const staff = await manager()
  if (!staff) return { fatal: "Réservé aux administrateurs." }
  if (typeof csv !== "string" || csv.length > MAX_IMPORT_BYTES) return { fatal: "Fichier trop volumineux." }
  if (rateLimited(`ads-commit:${staff.userId}`, 10, 10 * 60 * 1000)) return { fatal: "Trop d'imports. Réessayez plus tard." }
  const keys = Array.isArray(validatedKeys) ? validatedKeys.filter((k) => typeof k === "string").slice(0, 500) : []
  const res = await runWithOrg(staff.organizationId, () => commitCommissionImport(csv, keys, staff.userId))
  revalidatePath("/admin/rentabilite")
  return res
}

export async function confirmCommissionsAction(ids: number[]): Promise<{ confirmed: number; failed: number; message?: string }> {
  const staff = await manager()
  if (!staff) return { confirmed: 0, failed: 0, message: "Réservé aux administrateurs." }
  const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)
  const res = await runWithOrg(staff.organizationId, () => confirmCommissions(clean, staff.userId))
  revalidatePath("/admin/rentabilite")
  return res
}
