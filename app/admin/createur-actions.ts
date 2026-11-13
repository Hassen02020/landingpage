"use server"

// Actions du Créateur de Landing Pages. Chaque action revérifie CÔTÉ SERVEUR : session, droit « catalogue », organisation de la plateforme, débit.
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { builderAccess, publishPage, saveDraft, unpublishPage, type OfferInput } from "@/lib/server/page-builder"
import { uploadImage } from "@/lib/server/catalog"

export interface CreatorState { ok?: boolean; message?: string; errors?: Record<string, string> }

const OFFER_KEYS = ["name", "destination", "departure_date", "nights", "nights_detail", "price", "price_before", "seats_total", "tag", "description"] as const
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "")

function refreshPublicPages() {
  revalidatePath("/c/[slug]", "page")
  revalidatePath("/admin/createur")
  revalidatePath("/admin/createur/[id]", "page")
}

export async function saveDraftAction(_prev: CreatorState | undefined, fd: FormData): Promise<CreatorState> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return { ok: false, message: access.message }
  const errors: Record<string, string> = {}

  // images : transférées vers le stockage existant (JPG, PNG, WebP ; 4 Mo max)
  const category: Record<string, string> = {}
  for (const k of ["name", "slug", "lang", "headline", "description", "banner_desktop", "banner_mobile", "seo_title", "seo_description"]) category[k] = str(fd, k)
  for (const k of ["banner_desktop", "banner_mobile"] as const) {
    const file = fd.get(`${k}_file`)
    if (file instanceof File && file.size > 0) {
      const up = await uploadImage(file, "banners")
      if (!up.ok) errors[k] = up.error
      else category[k] = up.url
    }
  }

  const count = Math.max(0, Math.min(10, parseInt(str(fd, "offer_count") || "0", 10) || 0))
  const offers: OfferInput[] = []
  for (let i = 0; i < count; i++) {
    const fields: Record<string, string> = {}
    for (const k of OFFER_KEYS) fields[k] = str(fd, `o${i}_${k}`)
    fields.image_url = str(fd, `o${i}_image_url`)
    const file = fd.get(`o${i}_image_file`)
    if (file instanceof File && file.size > 0) {
      const up = await uploadImage(file, "offers")
      if (!up.ok) errors[`o${i}_image_url`] = up.error
      else fields.image_url = up.url
    }
    const id = str(fd, `o${i}_id`) || undefined
    const remove = str(fd, `o${i}_remove`) === "1"
    const features = str(fd, `o${i}_features`).split(/\r?\n/)
    const empty = !id && !fields.name.trim() && !fields.price.trim()
    if (empty) continue // ligne laissée vide : ignorée
    offers.push({ id, remove, fields, features })
  }
  if (Object.keys(errors).length) return { ok: false, errors, message: "Une image n'a pas pu être envoyée." }

  const res = await saveDraft({ id: str(fd, "id") || undefined, themeId: str(fd, "theme"), category, offers }, access.staff.userId)
  if (!res.ok) return { ok: false, errors: res.errors, message: res.message }
  refreshPublicPages()
  const theme = encodeURIComponent(str(fd, "theme"))
  const STEPS = ["infos", "formulaire", "apercu", "publication"]
  const next = STEPS.includes(str(fd, "next")) ? str(fd, "next") : ""
  if (next || !str(fd, "id")) redirect(`/admin/createur/${res.id}?etape=${next || "infos"}&theme=${theme}${next ? "" : "&ok=1"}`)
  return { ok: true, message: "Brouillon enregistré." }
}

export async function publishAction(_prev: CreatorState | undefined, fd: FormData): Promise<CreatorState> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return { ok: false, message: access.message }
  const res = await publishPage(str(fd, "id"), str(fd, "theme") || null, access.staff.userId)
  if (!res.ok) return { ok: false, message: res.message }
  refreshPublicPages()
  return { ok: true, message: "Page publiée." }
}

export async function unpublishAction(_prev: CreatorState | undefined, fd: FormData): Promise<CreatorState> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return { ok: false, message: access.message }
  const res = await unpublishPage(str(fd, "id"), access.staff.userId)
  if (!res.ok) return { ok: false, message: res.message }
  refreshPublicPages()
  return { ok: true, message: "Page masquée. Les liens déjà diffusés ne mèneront plus à une page visible." }
}
