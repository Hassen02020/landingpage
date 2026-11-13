// CRÉATEUR DE LANDING PAGES — couche serveur. RÉUTILISE le catalogue existant (saveCategory, saveOffer, archiveOffer, uploadImage) :
// une page = une catégorie (publiée sur /p/<adresse>) + ses offres. AUCUNE nouvelle table, AUCUNE migration. Le brouillon = une catégorie masquée (visible=false).
// Réservé à l'organisation de la PLATEFORME : /p/<adresse> (comme /c/<adresse>) n'est servie que pour elle (constat du chantier 1) ; toute autre entreprise est refusée côté serveur.
import { currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { isPlatformOrg, update } from "@/lib/server/db"
import { archiveOffer, getCategory, listCategories, listOffers, saveCategory, saveOffer, slugify, validateCategory, validateOffer, categorySlugLock, type Category, type Offer, type PublicOffer } from "@/lib/server/catalog"
import { tunisDay } from "@/lib/server/crm"
import { pageStatus, type PageStatus } from "@/lib/page-status"
import { readiness, type Readiness } from "@/lib/page-builder/readiness"
import { themeById, type Theme } from "@/lib/page-builder/themes"
import { rateLimited } from "@/lib/server/guard"
import type { SlugLock } from "@/lib/catalog-slug"

export type BuilderAccess = { ok: true; staff: NonNullable<Awaited<ReturnType<typeof currentStaff>>> } | { ok: false; reason: "droits" | "entreprise" | "debit"; message: string }

/** Contrôle d'accès SERVEUR (jamais seulement l'interface) : connecté, droit « catalogue », organisation de la plateforme. */
export async function builderAccess(opts: { write?: boolean } = {}): Promise<BuilderAccess> {
  const staff = await currentStaff()
  if (!staff || !can(staff.orgRole, "catalog.manage")) return { ok: false, reason: "droits", message: "Réservé aux administrateurs." }
  if (!(await isPlatformOrg())) {
    return { ok: false, reason: "entreprise", message: "Le Créateur de pages n'est pas encore disponible pour votre entreprise : ses pages sont publiées sur le site d'Easy2Book. Vos formulaires /o/… restent actifs." }
  }
  if (opts.write && rateLimited(`createur:${staff.userId}`, 120, 10 * 60 * 1000)) return { ok: false, reason: "debit", message: "Trop d'actions. Réessayez dans quelques minutes." }
  return { ok: true, staff }
}

export interface BuilderListItem { category: Category; status: PageStatus; offers: number }

export async function listBuilderPages(): Promise<BuilderListItem[]> {
  const today = tunisDay()
  const [cats, offers] = await Promise.all([listCategories(), listOffers()])
  return cats.map((category) => {
    const mine = offers.filter((o) => o.category_id === category.id)
    return { category, offers: mine.length, status: pageStatus({ visible: category.visible, offers: mine, today }) }
  })
}

export interface BuilderPage { category: Category; offers: Offer[]; status: PageStatus; lock: SlugLock; readiness: Readiness }

export async function loadBuilderPage(id: string, themeId?: string | null): Promise<BuilderPage | null> {
  const category = await getCategory(id)
  if (!category) return null
  const today = tunisDay()
  const offers = await listOffers({ categoryId: id })
  const lock = (await categorySlugLock(id))?.lock ?? { locked: false as const }
  return { category, offers, status: pageStatus({ visible: category.visible, offers, today }), lock, readiness: readiness(category, offers, today, themeId) }
}

/** Offres telles que les verrait le public (jamais le coût) — sert à l'aperçu d'une page masquée. */
export const toPublicOffers = (offers: Offer[]): PublicOffer[] =>
  offers.filter((o) => o.visible && !o.archived_at).map(({ cost: _c, archived_at: _a, updated_at: _u, ...rest }) => { void _c; void _a; void _u; return rest })

// ------------------------------------------------------------------------------------------------ enregistrement du brouillon
export interface OfferInput {
  id?: string
  remove?: boolean
  fields: Record<string, string>
  features: string[]
}
export interface DraftInput {
  id?: string
  themeId: string
  category: Record<string, string>
  offers: OfferInput[]
}
export type DraftResult = { ok: true; id: string } | { ok: false; errors: Record<string, string>; message: string }

export async function saveDraft(input: DraftInput, actorId: string | null): Promise<DraftResult> {
  const theme: Theme | null = themeById(input.themeId)
  if (!theme) return { ok: false, errors: { theme: "Modèle inconnu." }, message: "Choisissez un modèle valide." }
  const existing = input.id ? await getCategory(input.id) : null
  if (input.id && !existing) return { ok: false, errors: {}, message: "Page introuvable." }

  // le produit et la langue viennent du modèle à la création ; ensuite ceux de la page (changer de produit changerait la famille visuelle publique)
  const catFields: Record<string, string> = {
    name: input.category.name ?? "", slug: (input.category.slug || "").trim() || slugify(input.category.name ?? ""),
    product: existing?.product ?? theme.product, lang: input.category.lang === "ar" || input.category.lang === "fr" ? input.category.lang : existing?.lang ?? theme.lang,
    headline: input.category.headline ?? "", description: input.category.description ?? "",
    banner_desktop: input.category.banner_desktop ?? existing?.banner_desktop ?? "", banner_mobile: input.category.banner_mobile ?? existing?.banner_mobile ?? "",
    seo_title: input.category.seo_title ?? existing?.seo_title ?? "", seo_description: input.category.seo_description ?? existing?.seo_description ?? "",
    position: String(existing?.position ?? 0),
    visible: existing?.visible ? "on" : "", // enregistrer ne change JAMAIS l'état de publication
  }
  // validation complète AVANT toute écriture
  const errors: Record<string, string> = {}
  const cv = validateCategory(catFields)
  Object.assign(errors, cv.errors)
  input.offers.forEach((o, i) => {
    if (o.remove) return
    const v = validateOffer({ ...o.fields, product: catFields.product, visible: "on", position: String(i) }, o.features)
    for (const [k, msg] of Object.entries(v.errors)) errors[`o${i}_${k}`] = msg
  })
  if (Object.keys(errors).length) return { ok: false, errors, message: "Vérifiez les champs signalés." }

  const saved = await saveCategory(input.id ?? null, catFields, actorId)
  if (!saved.ok) return { ok: false, errors: saved.errors, message: saved.errors.slug ?? "Enregistrement impossible." }
  const categoryId = saved.id
  for (let i = 0; i < input.offers.length; i++) {
    const o = input.offers[i]
    if (o.remove) {
      if (o.id) await archiveOffer(o.id, true, actorId)
      continue
    }
    const f = { ...o.fields, product: catFields.product, category_id: categoryId, visible: "on", position: String(i) }
    const r = await saveOffer(o.id ?? null, f, o.features, actorId)
    if (!r.ok) return { ok: false, errors: Object.fromEntries(Object.entries(r.errors).map(([k, v]) => [`o${i}_${k}`, v])), message: "Vérifiez les champs signalés." }
  }
  return { ok: true, id: categoryId }
}

// ------------------------------------------------------------------------------------------------ publication
export type PublishResult = { ok: true } | { ok: false; message: string; readiness?: Readiness }

/** Publie (visible=true) UNIQUEMENT si la page est complète — contrôle refait côté serveur, indépendamment de l'interface. */
export async function publishPage(id: string, themeId: string | null, actorId: string | null): Promise<PublishResult> {
  const page = await loadBuilderPage(id, themeId)
  if (!page) return { ok: false, message: "Page introuvable." }
  if (!page.readiness.ready) return { ok: false, message: "La page est incomplète : corrigez les points signalés avant de publier.", readiness: page.readiness }
  await update("landing_categories", `id=eq.${id}`, { visible: true, updated_at: new Date().toISOString(), updated_by: actorId })
  return { ok: true }
}

export async function unpublishPage(id: string, actorId: string | null): Promise<PublishResult> {
  const page = await getCategory(id)
  if (!page) return { ok: false, message: "Page introuvable." }
  await update("landing_categories", `id=eq.${id}`, { visible: false, updated_at: new Date().toISOString(), updated_by: actorId })
  return { ok: true }
}

