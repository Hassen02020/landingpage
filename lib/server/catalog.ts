// Catalogue d'offres et catégories (/admin/catalogue) — pages publiques pilotées par l'admin.
// Lecture publique : uniquement les offres visibles, JAMAIS le coût.
import { insertOne, select, update } from "./db"
import type { Product } from "@/lib/config"

export interface Category {
  id: string
  slug: string
  name: string
  product: Product
  lang: "fr" | "ar"
  headline: string | null
  description: string | null
  banner_desktop: string | null
  banner_mobile: string | null
  seo_title: string | null
  seo_description: string | null
  visible: boolean
  position: number
  updated_at: string
}

export interface Offer {
  id: string
  category_id: string | null
  product: Product
  name: string
  sku: string | null
  tag: string | null
  destination: string | null
  departure_date: string | null
  nights: number | null
  nights_detail: string | null
  price: number | string
  price_before: number | string | null
  cost?: number | string | null
  seats_total: number | null
  seats_sold: number
  features: string[]
  description: string | null
  image_url: string | null
  visible: boolean
  position: number
  archived_at: string | null
  updated_at: string
}

export type PublicOffer = Omit<Offer, "cost" | "archived_at" | "updated_at">

const PUBLIC_OFFER_COLS =
  "id,category_id,product,name,sku,tag,destination,departure_date,nights,nights_detail,price,price_before,seats_total,seats_sold,features,description,image_url,visible,position"
const CATEGORY_COLS = "id,slug,name,product,lang,headline,description,banner_desktop,banner_mobile,seo_title,seo_description,visible,position,updated_at"

export const seatsLeft = (o: Pick<Offer, "seats_total" | "seats_sold">) => (o.seats_total === null ? null : Math.max(0, o.seats_total - o.seats_sold))

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID = /^[0-9a-f-]{36}$/i

// ---------------------------------------------------------------- lecture publique
export async function publicCategory(slug: string): Promise<{ category: Category; offers: PublicOffer[] } | null> {
  if (!SLUG.test(slug)) return null
  const [category] = await select<Category>("landing_categories", `select=${CATEGORY_COLS}&slug=eq.${slug}&visible=eq.true&limit=1`)
  if (!category) return null
  const offers = await select<PublicOffer>(
    "landing_offers",
    `select=${PUBLIC_OFFER_COLS}&category_id=eq.${category.id}&visible=eq.true&archived_at=is.null&order=position.asc,departure_date.asc&limit=100`
  )
  return { category, offers }
}

export type CategoryLookup = { status: "found"; data: { category: Category; offers: PublicOffer[] } } | { status: "not_found" } | { status: "error" }

/** Recherche à trois états : « introuvable » (slug inconnu ou masqué) se distingue d'une panne de base (« error »), qui ne doit jamais déclencher un secours. */
export async function lookupPublicCategory(slug: string): Promise<CategoryLookup> {
  try {
    const data = await publicCategory(slug)
    return data ? { status: "found", data } : { status: "not_found" }
  } catch {
    return { status: "error" }
  }
}

export async function publicCategories(): Promise<Pick<Category, "slug" | "name" | "product" | "headline" | "banner_mobile">[]> {
  return select("landing_categories", "select=slug,name,product,headline,banner_mobile&visible=eq.true&order=position.asc&limit=50")
}

// ---------------------------------------------------------------- administration
export async function listCategories(): Promise<Category[]> {
  return select<Category>("landing_categories", `select=${CATEGORY_COLS}&order=position.asc,name.asc&limit=200`)
}

export async function getCategory(id: string): Promise<Category | null> {
  if (!UUID.test(id)) return null
  const [c] = await select<Category>("landing_categories", `select=${CATEGORY_COLS}&id=eq.${id}&limit=1`)
  return c ?? null
}

export async function listOffers(opts: { archived?: boolean; categoryId?: string; q?: string } = {}): Promise<Offer[]> {
  const q = ["select=*", opts.archived ? "archived_at=not.is.null" : "archived_at=is.null", "order=position.asc,departure_date.asc", "limit=500"]
  if (opts.categoryId && UUID.test(opts.categoryId)) q.push(`category_id=eq.${opts.categoryId}`)
  const rows = await select<Offer>("landing_offers", q.join("&"))
  const term = (opts.q || "").trim().toLowerCase()
  return term ? rows.filter((o) => `${o.name} ${o.sku ?? ""} ${o.destination ?? ""}`.toLowerCase().includes(term)) : rows
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!UUID.test(id)) return null
  const [o] = await select<Offer>("landing_offers", `select=*&id=eq.${id}&limit=1`)
  return o ?? null
}

// ---------------------------------------------------------------- validation
const DAY = /^\d{4}-\d{2}-\d{2}$/
const URL_RE = /^(https:\/\/|\/)[^\s"'<>]{1,500}$/
// lien vers NOTRE stockage (même hôte que LANDING_SUPABASE_URL) : accepté même en http (base locale de test)
const isOwnStorage = (v: string) => {
  const base = process.env.LANDING_SUPABASE_URL?.replace(/\/$/, "")
  return Boolean(base) && v.startsWith(`${base}/storage/v1/object/public/landing-media/`) && !/[\s"'<>]/.test(v) && v.length <= 500
}
const safeUrl = (v: string) => URL_RE.test(v) || isOwnStorage(v)
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".").replace(/\s/g, "")))
const int = (v: string) => (v.trim() === "" ? null : parseInt(v, 10))
const PRODUCTS = ["omra", "voyage", "hotel", "autre"]

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function validateOffer(f: Record<string, string>, features: string[]): { row?: Record<string, unknown>; errors: Record<string, string> } {
  const e: Record<string, string> = {}
  const name = (f.name || "").trim()
  if (name.length < 2 || name.length > 120) e.name = "Nom requis (120 caractères max)."
  const product = PRODUCTS.includes(f.product) ? f.product : null
  if (!product) e.product = "Produit requis."
  const price = num(f.price || "")
  if (price === null || !(price >= 0)) e.price = "Prix requis (TND)."
  const priceBefore = num(f.price_before || "")
  if (priceBefore !== null && !(priceBefore >= 0)) e.price_before = "Montant invalide."
  const cost = num(f.cost || "")
  if (cost !== null && !(cost >= 0)) e.cost = "Montant invalide."
  const nights = int(f.nights || "")
  if (nights !== null && !(nights >= 0 && nights <= 120)) e.nights = "0 à 120."
  const seatsTotal = int(f.seats_total || "")
  const seatsSold = int(f.seats_sold || "") ?? 0
  if (seatsTotal !== null && !(seatsTotal >= 0)) e.seats_total = "Nombre positif ou vide."
  if (!(seatsSold >= 0)) e.seats_sold = "Nombre positif."
  if (seatsTotal !== null && seatsSold > seatsTotal) e.seats_sold = "Plus de places vendues que de places totales."
  const date = (f.departure_date || "").trim()
  if (date && !DAY.test(date)) e.departure_date = "Date invalide."
  const sku = (f.sku || "").trim().toUpperCase()
  if (sku && !/^[A-Z0-9-]{3,32}$/.test(sku)) e.sku = "3 à 32 caractères : majuscules, chiffres, -."
  const image = (f.image_url || "").trim()
  if (image && !safeUrl(image)) e.image_url = "Lien https:// ou chemin /… attendu."
  const categoryId = (f.category_id || "").trim()
  if (categoryId && !UUID.test(categoryId)) e.category_id = "Catégorie invalide."
  const feats = features.map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => x.slice(0, 160))
  if (Object.keys(e).length) return { errors: e }
  return {
    errors: e,
    row: {
      name,
      product,
      price,
      price_before: priceBefore,
      cost,
      nights,
      nights_detail: (f.nights_detail || "").trim().slice(0, 160) || null,
      seats_total: seatsTotal,
      seats_sold: seatsSold,
      departure_date: date || null,
      sku: sku || null,
      tag: (f.tag || "").trim().slice(0, 40) || null,
      destination: (f.destination || "").trim().slice(0, 120) || null,
      description: (f.description || "").trim().slice(0, 4000) || null,
      image_url: image || null,
      category_id: categoryId || null,
      visible: f.visible === "on",
      position: int(f.position || "") ?? 0,
      features: feats,
    },
  }
}

export function validateCategory(f: Record<string, string>): { row?: Record<string, unknown>; errors: Record<string, string> } {
  const e: Record<string, string> = {}
  const name = (f.name || "").trim()
  if (name.length < 2 || name.length > 120) e.name = "Nom requis (120 caractères max)."
  const slug = (f.slug || "").trim() || slugify(name)
  if (!SLUG.test(slug) || slug.length > 60) e.slug = "Adresse : lettres minuscules, chiffres et tirets (ex. omra-2027)."
  const product = PRODUCTS.includes(f.product) ? f.product : null
  if (!product) e.product = "Produit requis."
  const lang = f.lang === "ar" ? "ar" : "fr"
  for (const k of ["banner_desktop", "banner_mobile"]) {
    const v = (f[k] || "").trim()
    if (v && !safeUrl(v)) e[k] = "Lien https:// ou chemin /… attendu."
  }
  const seoTitle = (f.seo_title || "").trim()
  if (seoTitle.length > 70) e.seo_title = "70 caractères maximum."
  const seoDesc = (f.seo_description || "").trim()
  if (seoDesc.length > 160) e.seo_description = "160 caractères maximum."
  if (Object.keys(e).length) return { errors: e }
  return {
    errors: e,
    row: {
      name,
      slug,
      product,
      lang,
      headline: (f.headline || "").trim().slice(0, 160) || null,
      description: (f.description || "").trim().slice(0, 2000) || null,
      banner_desktop: (f.banner_desktop || "").trim() || null,
      banner_mobile: (f.banner_mobile || "").trim() || null,
      seo_title: seoTitle || null,
      seo_description: seoDesc || null,
      visible: f.visible === "on",
      position: int(f.position || "") ?? 0,
    },
  }
}

// ---------------------------------------------------------------- écriture
type Saved = { ok: true; id: string } | { ok: false; errors: Record<string, string> }
const stamp = (actorId: string | null) => ({ updated_at: new Date().toISOString(), updated_by: actorId })

export async function saveOffer(id: string | null, f: Record<string, string>, features: string[], actorId: string | null): Promise<Saved> {
  const { row, errors } = validateOffer(f, features)
  if (!row) return { ok: false, errors }
  try {
    if (id) {
      if (!UUID.test(id)) return { ok: false, errors: { form: "Offre introuvable." } }
      await update("landing_offers", `id=eq.${id}`, { ...row, ...stamp(actorId) })
      return { ok: true, id }
    }
    const created = await insertOne<{ id: string }>("landing_offers", { ...row, ...stamp(actorId) })
    return { ok: true, id: created.id }
  } catch (err) {
    if ((err as { isUniqueViolation?: boolean }).isUniqueViolation) return { ok: false, errors: { sku: "Ce SKU existe déjà." } }
    throw err
  }
}

export async function duplicateOffer(id: string, actorId: string | null): Promise<string | null> {
  const o = await getOffer(id)
  if (!o) return null
  const { id: _id, archived_at: _a, updated_at: _u, ...rest } = o
  void _id
  void _a
  void _u
  const created = await insertOne<{ id: string }>("landing_offers", {
    ...rest,
    name: `${o.name} (copie)`.slice(0, 120),
    sku: null,
    seats_sold: 0,
    visible: false, // une copie n'est jamais publiée d'office
    ...stamp(actorId),
  })
  return created.id
}

export async function archiveOffer(id: string, archived: boolean, actorId: string | null) {
  if (!UUID.test(id)) return
  await update("landing_offers", `id=eq.${id}`, { archived_at: archived ? new Date().toISOString() : null, ...(archived ? { visible: false } : {}), ...stamp(actorId) })
}

export async function saveCategory(id: string | null, f: Record<string, string>, actorId: string | null): Promise<Saved> {
  const { row, errors } = validateCategory(f)
  if (!row) return { ok: false, errors }
  try {
    if (id) {
      if (!UUID.test(id)) return { ok: false, errors: { form: "Catégorie introuvable." } }
      await update("landing_categories", `id=eq.${id}`, { ...row, ...stamp(actorId) })
      return { ok: true, id }
    }
    const created = await insertOne<{ id: string }>("landing_categories", { ...row, ...stamp(actorId) })
    return { ok: true, id: created.id }
  } catch (err) {
    if ((err as { isUniqueViolation?: boolean }).isUniqueViolation) return { ok: false, errors: { slug: "Cette adresse est déjà utilisée." } }
    throw err
  }
}

// ---------------------------------------------------------------- médias (Supabase Storage)
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export async function uploadImage(file: File, folder: "offers" | "banners"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = MIME[file.type]
  if (!ext) return { ok: false, error: "Format accepté : JPG, PNG ou WebP." }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image trop lourde (4 Mo maximum)." }
  const base = process.env.LANDING_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return { ok: false, error: "Base non configurée." }
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`
  const res = await fetch(`${base}/storage/v1/object/landing-media/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, error: `Envoi refusé par le stockage (${res.status}). Migration 0004 appliquée ?` }
  return { ok: true, url: `${base}/storage/v1/object/public/landing-media/${path}` }
}
