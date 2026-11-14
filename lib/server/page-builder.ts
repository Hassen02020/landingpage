// CRÉATEUR DE LANDING PAGES — couche serveur. RÉUTILISE le catalogue existant (saveCategory, saveOffer, archiveOffer, uploadImage) :
// une page = une catégorie (publiée sur /p/<adresse>) + ses offres. AUCUNE nouvelle table, AUCUNE migration. Le brouillon = une catégorie masquée (visible=false).
// Réservé à l'organisation de la PLATEFORME : /p/<adresse> (comme /c/<adresse>) n'est servie que pour elle (constat du chantier 1) ; toute autre entreprise est refusée côté serveur.
import { currentStaff } from "@/lib/server/auth"
import { can } from "@/lib/permissions"
import { insertOne, isPlatformOrg, update } from "@/lib/server/db"
import { archiveOffer, getCategory, listCategories, listOffers, saveCategory, saveOffer, slugify, validateCategory, validateOffer, categorySlugLock, type Category, type Offer, type PublicOffer } from "@/lib/server/catalog"
import { tunisDay } from "@/lib/server/crm"
import { isOfferExpired, pageStatus, type PageStatus } from "@/lib/page-status"
import { readiness, type Readiness } from "@/lib/page-builder/readiness"
import { themeById, type Theme } from "@/lib/page-builder/themes"
import { rateLimited } from "@/lib/server/guard"
import { saveDesign } from "@/lib/server/page-design"
import type { Product } from "@/lib/config"
import type { SlugLock } from "@/lib/catalog-slug"
import { ARCHIVED_POSITION, copySlug, isArchived } from "@/lib/page-builder/dashboard"

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
    name: input.category.name ?? "", slug: (input.category.slug || "").trim() || slugify(input.category.name ?? "") || (!existing ? theme.preset?.slug ?? theme.id : ""),
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
  // préréglage de personnalisation du modèle : appliqué UNIQUEMENT à la création, jamais écrasant ; sans colonne `design` (migration 0018) la page est créée sans lui
  if (!input.id && theme.preset) {
    try { await saveDesign(categoryId, catFields.product as Product, theme.preset.design, actorId) } catch (e) { console.error("[createur] préréglage de personnalisation non appliqué", e instanceof Error ? e.message : "erreur") }
  }
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


// ------------------------------------------------------------------------------------------------ duplication, archivage
export type LifecycleResult = { ok: true; id: string } | { ok: false; message: string }

/** Copie d'une page : NOUVEL id, adresse libre (« -copie »), toujours en BROUILLON ; offres copiées sans places vendues ni SKU. Jamais d'effet sur l'original. */
export async function duplicatePage(id: string, actorId: string | null): Promise<LifecycleResult> {
  const src = await getCategory(id)
  if (!src) return { ok: false, message: "Page introuvable." }
  const [cats, offers] = await Promise.all([listCategories(), listOffers({ categoryId: id })])
  const stamp = { updated_at: new Date().toISOString(), updated_by: actorId }
  const created = await insertOne<{ id: string }>("landing_categories", {
    slug: copySlug(src.slug, cats.map((c) => c.slug)), name: `${src.name} (copie)`.slice(0, 120), product: src.product, lang: src.lang,
    headline: src.headline, description: src.description, banner_desktop: src.banner_desktop, banner_mobile: src.banner_mobile,
    seo_title: src.seo_title, seo_description: src.seo_description, visible: false, position: 0, ...stamp,
  })
  for (const o of offers) {
    const { id: _i, archived_at: _a, updated_at: _u, ...rest } = o
    void _i; void _a; void _u
    await insertOne("landing_offers", { ...rest, category_id: created.id, sku: null, seats_sold: 0, ...stamp })
  }
  return { ok: true, id: created.id }
}

/** Archivage CONTRÔLÉ : une page publiée doit d'abord être désactivée (son adresse cesserait sinon de répondre sans prévenir). L'adresse reste réservée. */
export async function archivePage(id: string, actorId: string | null): Promise<LifecycleResult> {
  const page = await getCategory(id)
  if (!page) return { ok: false, message: "Page introuvable." }
  if (page.visible) return { ok: false, message: "Cette page est publiée : désactivez-la d'abord, puis archivez-la." }
  await update("landing_categories", `id=eq.${id}`, { position: ARCHIVED_POSITION, visible: false, updated_at: new Date().toISOString(), updated_by: actorId })
  return { ok: true, id }
}

/** Restauration : retour en BROUILLON (jamais publiée d'office). */
export async function restorePage(id: string, actorId: string | null): Promise<LifecycleResult> {
  const page = await getCategory(id)
  if (!page) return { ok: false, message: "Page introuvable." }
  if (!isArchived(page)) return { ok: false, message: "Cette page n'est pas archivée." }
  await update("landing_categories", `id=eq.${id}`, { position: 0, visible: false, updated_at: new Date().toISOString(), updated_by: actorId })
  return { ok: true, id }
}

// ------------------------------------------------------------------------------------------------ statistiques commerciales (lecture seule)
import { loadProfitability } from "@/lib/server/profitability"
import { select as dbSelect } from "@/lib/server/db"
import { pageStats, type StatCard } from "@/lib/page-builder/stats"
import { periodFilter, type Period } from "@/lib/server/stats"

export interface PageStatsResult { cards: StatCard[]; leadsInPeriod: number; truncated: boolean }

/** Réutilise le moteur de rentabilité (une seule vérité financière) ; aucune donnée personnelle n'est lue (agrégats et identifiants anonymes de visiteurs). */
export async function loadPageStats(slug: string, p: Period): Promise<PageStatsResult> {
  const prof = await loadProfitability(p, "niche")
  const row = prof.result.rows.find((r) => r.key === slug) ?? null
  let visitors: number | null = null
  try {
    const ev = await dbSelect<{ visitor_ref: string | null }>("landing_events", `select=visitor_ref&niche=eq.${encodeURIComponent(slug)}&event_name=in.(ViewContent,CategoryView)&${periodFilter("created_at", p)}&limit=20000`)
    visitors = new Set(ev.map((e) => e.visitor_ref).filter(Boolean)).size
  } catch { visitors = null }
  return { cards: pageStats({ metrics: row?.metrics ?? null, spendBasis: row?.spendBasis ?? "aucune", ledgerAvailable: prof.migrationApplied, consentingVisitors: visitors }), leadsInPeriod: prof.leadCount, truncated: prof.truncated }
}

// ------------------------------------------------------------------------------------------------ reprise d'offres du catalogue existant
export interface CatalogueOffer {
  id: string; name: string; destination: string | null; departure_date: string | null; nights: number | null; nights_detail: string | null
  price: number | string; price_before: number | string | null; seats_total: number | null; tag: string | null; description: string | null
  features: string[]; image_url: string | null; page: string; expired: boolean
}

/** Offres RÉELLES du catalogue (hors archivées et hors page en cours), sans le coût ni les places vendues : seul le serveur voit les marges. */
export async function catalogueOffers(excludeCategoryId?: string): Promise<CatalogueOffer[]> {
  const today = tunisDay()
  const [offers, cats] = await Promise.all([listOffers(), listCategories()])
  const name = new Map(cats.map((c) => [c.id, c.name]))
  return offers
    .filter((o) => !o.archived_at && o.category_id !== excludeCategoryId)
    .slice(0, 200)
    .map((o) => ({
      id: o.id, name: o.name, destination: o.destination, departure_date: o.departure_date, nights: o.nights, nights_detail: o.nights_detail,
      price: o.price, price_before: o.price_before, seats_total: o.seats_total, tag: o.tag, description: o.description, features: o.features ?? [],
      image_url: o.image_url, page: o.category_id ? name.get(o.category_id) ?? "Sans page" : "Sans page", expired: isOfferExpired(o.departure_date, today),
    }))
}
