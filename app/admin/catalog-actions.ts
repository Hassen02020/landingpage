"use server"

// Actions du catalogue (/admin/catalogue) — rôle « admin » revérifié à chaque appel.
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { rateLimited } from "@/lib/server/guard"
import { archiveOffer, duplicateOffer, saveCategory, saveOffer, uploadImage } from "@/lib/server/catalog"

export interface CatalogFormState {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
}

async function requireAdmin() {
  const staff = await currentStaff()
  if (!staff || !(can(staff.orgRole, "catalog.manage") && can(staff.orgRole, "promos.manage"))) return null
  if (rateLimited(`catalog:${staff.userId}`, 120, 10 * 60 * 1000)) return null
  return staff
}

const fields = (fd: FormData) => {
  const out: Record<string, string> = {}
  fd.forEach((v, k) => {
    if (typeof v === "string") out[k] = v
  })
  return out
}

function refreshPublicPages() {
  revalidatePath("/omra")
  revalidatePath("/c/[slug]", "page")
}

export async function saveOfferAction(_p: CatalogFormState | undefined, fd: FormData): Promise<CatalogFormState> {
  const staff = await requireAdmin()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  const f = fields(fd)
  const image = fd.get("image_file")
  if (image instanceof File && image.size > 0) {
    const up = await uploadImage(image, "offers")
    if (!up.ok) return { ok: false, errors: { image_url: up.error }, message: up.error }
    f.image_url = up.url
  }
  const features = String(f.features || "").split("\n")
  let res
  try {
    res = await saveOffer(f.id || null, f, features, staff.userId)
  } catch {
    return { ok: false, message: "Enregistrement impossible (migration 0004 appliquée ?)." }
  }
  if (!res.ok) return { ok: false, errors: res.errors, message: "Vérifiez les champs signalés." }
  refreshPublicPages()
  revalidatePath("/admin/catalogue")
  if (!f.id) redirect(`/admin/catalogue/offres/${res.id}?ok=1`)
  return { ok: true, message: "Offre enregistrée. Page publique mise à jour en moins d'une minute." }
}

export async function saveCategoryAction(_p: CatalogFormState | undefined, fd: FormData): Promise<CatalogFormState> {
  const staff = await requireAdmin()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  const f = fields(fd)
  for (const k of ["banner_desktop", "banner_mobile"] as const) {
    const file = fd.get(`${k}_file`)
    if (file instanceof File && file.size > 0) {
      const up = await uploadImage(file, "banners")
      if (!up.ok) return { ok: false, errors: { [k]: up.error }, message: up.error }
      f[k] = up.url
    }
  }
  let res
  try {
    res = await saveCategory(f.id || null, f, staff.userId)
  } catch {
    return { ok: false, message: "Enregistrement impossible (migration 0004 appliquée ?)." }
  }
  if (!res.ok) return { ok: false, errors: res.errors, message: "Vérifiez les champs signalés." }
  refreshPublicPages()
  revalidatePath("/admin/catalogue")
  if (!f.id) redirect(`/admin/catalogue/categories/${res.id}?ok=1`)
  return { ok: true, message: "Catégorie enregistrée." }
}

export async function duplicateOfferAction(fd: FormData): Promise<void> {
  const staff = await requireAdmin()
  if (!staff) return
  const id = await duplicateOffer(String(fd.get("id") ?? ""), staff.userId).catch(() => null)
  revalidatePath("/admin/catalogue")
  if (id) redirect(`/admin/catalogue/offres/${id}?ok=copie`)
}

export async function archiveOfferAction(fd: FormData): Promise<void> {
  const staff = await requireAdmin()
  if (!staff) return
  await archiveOffer(String(fd.get("id") ?? ""), fd.get("archived") === "true", staff.userId).catch(() => undefined)
  refreshPublicPages()
  revalidatePath("/admin/catalogue")
}
