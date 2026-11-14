"use server"

// Actions du Créateur de Landing Pages. Chaque action revérifie CÔTÉ SERVEUR : session, droit « catalogue », organisation de la plateforme, débit.
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { archivePage, builderAccess, duplicatePage, publishPage, restorePage, saveDraft, unpublishPage, type OfferInput } from "@/lib/server/page-builder"
import { uploadImage, getCategory } from "@/lib/server/catalog"
import { saveDesign } from "@/lib/server/page-design"
import { recordVersion, restoreVersion } from "@/lib/server/page-versions"
import { clearSchedule, runDueSchedules, setSchedule } from "@/lib/server/page-schedule"
import type { DesignErrors } from "@/lib/page-builder/design"

export interface CreatorState { ok?: boolean; message?: string; errors?: Record<string, string> }

const OFFER_KEYS = ["name", "destination", "departure_date", "nights", "nights_detail", "price", "price_before", "seats_total", "tag", "description"] as const
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "")

function refreshPublicPages() {
  revalidatePath("/c/[slug]", "page")
  revalidatePath("/p/[slug]", "page")
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
  const STEPS = ["infos", "design", "formulaire", "apercu", "publication"]
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

// Actions du tableau de bord (formulaires simples : fonctionnent sans JavaScript). Retour au tableau avec un message.
const back = (msg: string, ok: boolean, extra = "") => redirect(`/admin/createur?${ok ? "ok" : "erreur"}=${encodeURIComponent(msg)}${extra}`)

export async function duplicateAction(fd: FormData): Promise<void> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  const res = await duplicatePage(str(fd, "id"), access.staff.userId)
  if (!res.ok) return back(res.message, false)
  refreshPublicPages()
  redirect(`/admin/createur/${res.id}?etape=infos&ok=1&copie=1`)
}

export async function archiveAction(fd: FormData): Promise<void> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  const res = await archivePage(str(fd, "id"), access.staff.userId)
  refreshPublicPages()
  return res.ok ? back("Page archivée. Son adresse reste réservée.", true) : back(res.message, false)
}

export async function restoreAction(fd: FormData): Promise<void> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  const res = await restorePage(str(fd, "id"), access.staff.userId)
  refreshPublicPages()
  return res.ok ? back("Page restaurée en brouillon.", true, "&vue=brouillon") : back(res.message, false)
}

export async function unpublishFromListAction(fd: FormData): Promise<void> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  const res = await unpublishPage(str(fd, "id"), access.staff.userId)
  refreshPublicPages()
  return res.ok ? back("Page désactivée (masquée). Vous pouvez maintenant l'archiver.", true, "&vue=brouillon") : back(res.message, false)
}

export interface DesignState { ok?: boolean; message?: string; errors?: DesignErrors }

/** Personnalisation : le navigateur envoie le design en JSON, le SERVEUR le revalide intégralement (couleurs, bornes, sections autorisées). */
export async function saveDesignAction(_prev: DesignState | undefined, fd: FormData): Promise<DesignState> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return { ok: false, message: access.message }
  let raw: unknown
  try { raw = JSON.parse(str(fd, "design")) } catch { return { ok: false, message: "Données de personnalisation illisibles." } }
  const category = await getCategory(str(fd, "id"))
  if (!category) return { ok: false, message: "Page introuvable." }
  const res = await saveDesign(category.id, category.product, raw, access.staff.userId)
  if (!res.ok) return { ok: false, message: res.message, errors: res.errors }
  await recordVersion(category.id, "personnalisation", access.staff.userId)
  refreshPublicPages()
  return { ok: true, message: category.visible ? "Personnalisation enregistrée : la page publiée est à jour." : "Personnalisation enregistrée." }
}

/** Restauration d'une version : jamais l'adresse ni l'état de publication ; confirmation obligatoire (case à cocher) vérifiée CÔTÉ SERVEUR. */
export async function restoreVersionAction(fd: FormData): Promise<void> {
  const id = str(fd, "id")
  const back = (msg: string, ok: boolean) => redirect(`/admin/createur/${encodeURIComponent(id)}?etape=versions&${ok ? "ok" : "erreur"}=${encodeURIComponent(msg)}`)
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  if (str(fd, "confirm") !== "1") return back("Cochez la confirmation pour restaurer cette version.", false)
  const res = await restoreVersion(id, parseInt(str(fd, "version"), 10), access.staff.userId)
  if (!res.ok) return back(res.message, false)
  refreshPublicPages()
  return back(`Version restaurée (${res.restoredOffers} offre${res.restoredOffers > 1 ? "s" : ""} remise${res.restoredOffers > 1 ? "s" : ""} à l'état de la version${res.skippedOffers ? `, ${res.skippedOffers} ignorée${res.skippedOffers > 1 ? "s" : ""} car supprimée${res.skippedOffers > 1 ? "s" : ""}` : ""}).`, true)
}

// ---------------------------------------------------------------------------------------------- publication programmée
const backToPublication = (id: string, msg: string, ok: boolean) => redirect(`/admin/createur/${encodeURIComponent(id)}?etape=publication&${ok ? "okp" : "erreurp"}=${encodeURIComponent(msg)}`)

export async function scheduleAction(fd: FormData): Promise<void> {
  const id = str(fd, "id")
  const access = await builderAccess({ write: true })
  if (!access.ok) return backToPublication(id, access.message, false)
  const res = await setSchedule(id, { publishAt: str(fd, "publish_at"), unpublishAt: str(fd, "unpublish_at") }, access.staff.userId)
  refreshPublicPages()
  return res.ok ? backToPublication(id, "Programmation enregistrée (heure de Tunis).", true) : backToPublication(id, res.message, false)
}

export async function clearScheduleAction(fd: FormData): Promise<void> {
  const id = str(fd, "id")
  const access = await builderAccess({ write: true })
  if (!access.ok) return backToPublication(id, access.message, false)
  const res = await clearSchedule(id, access.staff.userId)
  refreshPublicPages()
  return res.ok ? backToPublication(id, "Programmation annulée.", true) : backToPublication(id, res.message, false)
}

/** « Appliquer les programmations échues » : même exécution que la route protégée, à la demande d'un administrateur connecté. */
export async function runSchedulesAction(): Promise<void> {
  const access = await builderAccess({ write: true })
  if (!access.ok) return back(access.message, false)
  const r = await runDueSchedules()
  refreshPublicPages()
  if (!r.available) return back("La publication programmée nécessite la migration 0021 (fichier prêt, à appliquer par le propriétaire).", false)
  const parts = [`${r.published} publiée${r.published > 1 ? "s" : ""}`, `${r.unpublished} masquée${r.unpublished > 1 ? "s" : ""}`]
  if (r.blocked.length) return back(`${parts.join(", ")} ; ${r.blocked.length} bloquée${r.blocked.length > 1 ? "s" : ""} (page incomplète ou offres expirées : ouvrez-la pour corriger).`, false)
  return back(`Programmations échues appliquées : ${parts.join(", ")}.`, true)
}
