"use server"

// Modération des avis des visiteurs — permission « catalog.manage » revérifiée à chaque appel ; seul le statut change.
import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { moderateReview } from "@/lib/server/reviews"

export async function moderateReviewAction(fd: FormData): Promise<void> {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "catalog.manage")) return
  if (rateLimited(`avis:${staff.userId}`, 120, 10 * 60 * 1000)) return
  const status = String(fd.get("status") ?? "")
  if (status !== "published" && status !== "rejected") return
  await moderateReview(String(fd.get("id") ?? ""), status, staff.userId)
  revalidatePath("/admin/avis")
}
