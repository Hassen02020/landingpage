// HISTORIQUE DES VERSIONS d'une page (table landing_page_versions, migration 0020 — fichier local, NON appliqué).
// Registre à ajout seul. TANT QUE LA TABLE N'EXISTE PAS : l'enregistrement d'une version est ignoré en silence (jamais d'erreur sur l'action de
// l'employé), la liste est « indisponible » et la restauration refusée avec un message clair. Un instantané ne contient jamais le coût des offres,
// leur SKU ni les places vendues (données d'exploitation, pas de contenu de page).
import { DbError, insertOne, select } from "@/lib/server/db"
import { getCategory, listOffers, saveCategory, saveOffer, type Category } from "@/lib/server/catalog"
import { loadDesign, saveDesign } from "@/lib/server/page-design"
import type { Product } from "@/lib/config"

export type VersionReason = "enregistrement" | "personnalisation" | "publication" | "desactivation" | "restauration"
export const REASON_LABELS: Record<VersionReason, string> = { enregistrement: "Enregistrement du brouillon", personnalisation: "Personnalisation", publication: "Publication", desactivation: "Désactivation", restauration: "Restauration" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SnapshotOffer { id: string; name: string; destination: string | null; departure_date: string | null; nights: number | null; nights_detail: string | null; price: number | string; price_before: number | string | null; seats_total: number | null; tag: string | null; description: string | null; features: string[]; image_url: string | null; visible: boolean; position: number }
export interface Snapshot {
  v: 1
  category: { name: string; slug: string; product: string; lang: string; headline: string | null; description: string | null; banner_desktop: string | null; banner_mobile: string | null; seo_title: string | null; seo_description: string | null; visible: boolean }
  design: Record<string, unknown> | null
  offers: SnapshotOffer[]
}

const isMissingTable = (e: unknown): boolean => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)
/** JSON canonique (clés triées) : compare deux instantanés sans dépendre de l'ordre des clés renvoyé par la base. */
export const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x))

export async function buildSnapshot(categoryId: string): Promise<Snapshot | null> {
  const c = await getCategory(categoryId)
  if (!c) return null
  const offers = await listOffers({ categoryId })
  const d = await loadDesign(c.id, c.product).catch(() => null)
  return {
    v: 1,
    category: { name: c.name, slug: c.slug, product: c.product, lang: c.lang, headline: c.headline, description: c.description, banner_desktop: c.banner_desktop, banner_mobile: c.banner_mobile, seo_title: c.seo_title, seo_description: c.seo_description, visible: c.visible },
    design: d && d.available && d.stored ? (d.design as unknown as Record<string, unknown>) : null,
    offers: offers.filter((o) => !o.archived_at).map((o) => ({ id: o.id, name: o.name, destination: o.destination, departure_date: o.departure_date, nights: o.nights, nights_detail: o.nights_detail, price: o.price, price_before: o.price_before, seats_total: o.seats_total, tag: o.tag, description: o.description, features: o.features ?? [], image_url: o.image_url, visible: o.visible, position: o.position })),
  }
}

/** Enregistre une version SI le contenu a changé depuis la dernière. Ne lève JAMAIS d'exception : l'historique ne doit pas bloquer le travail. */
export async function recordVersion(categoryId: string, reason: VersionReason, actorId: string | null, note?: string): Promise<void> {
  try {
    if (!UUID.test(categoryId)) return
    const snap = await buildSnapshot(categoryId)
    if (!snap) return
    const rows = await select<{ version_number: number; snapshot: unknown }>("landing_page_versions", `select=version_number,snapshot&category_id=eq.${categoryId}&order=version_number.desc&limit=1`)
    const last = rows.slice().sort((a, b) => b.version_number - a.version_number)[0]
    if (last && canon(last.snapshot) === canon(snap)) return
    await insertOne("landing_page_versions", { category_id: categoryId, version_number: (last?.version_number ?? 0) + 1, reason, note: note ? note.slice(0, 200) : null, snapshot: snap, created_by: actorId })
  } catch (e) {
    if (isMissingTable(e)) return
    if ((e as { isUniqueViolation?: boolean }).isUniqueViolation) return // deux enregistrements simultanés : l'autre a pris le numéro
    console.error("[versions] enregistrement impossible", e instanceof Error ? e.message : "erreur")
  }
}

export interface VersionRow { id: number; version_number: number; reason: VersionReason; note: string | null; created_at: string; created_by: string | null }
export async function listVersions(categoryId: string, limit = 30): Promise<{ available: boolean; versions: VersionRow[] }> {
  if (!UUID.test(categoryId)) return { available: false, versions: [] }
  try {
    const rows = await select<VersionRow>("landing_page_versions", `select=id,version_number,reason,note,created_at,created_by&category_id=eq.${categoryId}&order=version_number.desc&limit=${limit}`)
    return { available: true, versions: rows.slice().sort((a, b) => b.version_number - a.version_number).slice(0, limit) }
  } catch (e) {
    if (isMissingTable(e)) return { available: false, versions: [] }
    throw e
  }
}

export type RestoreResult = { ok: true; restoredOffers: number; skippedOffers: number } | { ok: false; message: string }

/**
 * Restaure le CONTENU d'une version : textes, bannières, référencement, personnalisation et offres EXISTANTES (mêmes identifiants).
 * Jamais restaurés : l'ADRESSE (stable) et l'ÉTAT de publication (restaurer ne publie ni ne masque), le produit, ainsi que le prix d'achat, les places
 * vendues et le SKU. Une offre de l'instantané qui n'existe plus est ignorée et comptée. Chaque champ repasse par la validation habituelle.
 */
export async function restoreVersion(categoryId: string, versionId: number, actorId: string | null): Promise<RestoreResult> {
  const current = await getCategory(categoryId)
  if (!current) return { ok: false, message: "Page introuvable." }
  if (!Number.isInteger(versionId) || versionId < 1) return { ok: false, message: "Version introuvable." }
  let snap: Snapshot | null = null
  try {
    const [row] = await select<{ snapshot: Snapshot; version_number: number }>("landing_page_versions", `select=snapshot,version_number&id=eq.${versionId}&category_id=eq.${categoryId}&limit=1`)
    snap = row?.snapshot ?? null
    if (row && snap?.v === 1 && snap.category && Array.isArray(snap.offers)) {
      const c = snap.category
      const fields: Record<string, string> = {
        name: c.name, slug: current.slug, product: current.product, lang: c.lang, headline: c.headline ?? "", description: c.description ?? "",
        banner_desktop: c.banner_desktop ?? "", banner_mobile: c.banner_mobile ?? "", seo_title: c.seo_title ?? "", seo_description: c.seo_description ?? "",
        position: String(current.position), visible: current.visible ? "on" : "",
      }
      const saved = await saveCategory(categoryId, fields, actorId)
      if (!saved.ok) return { ok: false, message: "Cette version ne peut pas être restaurée telle quelle : " + Object.values(saved.errors).join(" ") }
      const live = await listOffers({ categoryId })
      const ids = new Set(live.filter((o) => !o.archived_at).map((o) => o.id))
      let restored = 0, skipped = 0
      for (const o of snap.offers) {
        if (!ids.has(o.id)) { skipped++; continue }
        const f: Record<string, string> = {
          name: o.name, destination: o.destination ?? "", departure_date: o.departure_date ?? "", nights: o.nights === null ? "" : String(o.nights), nights_detail: o.nights_detail ?? "",
          price: String(o.price), price_before: o.price_before === null ? "" : String(o.price_before), seats_total: o.seats_total === null ? "" : String(o.seats_total), tag: o.tag ?? "",
          description: o.description ?? "", image_url: o.image_url ?? "", product: current.product, category_id: categoryId, visible: o.visible ? "on" : "", position: String(o.position),
        }
        const r = await saveOffer(o.id, f, o.features ?? [], actorId)
        if (r.ok) restored++; else skipped++
      }
      if (snap.design) await saveDesign(categoryId, current.product as Product, snap.design, actorId)
      await recordVersion(categoryId, "restauration", actorId, `Restauration de la version ${row.version_number}`)
      return { ok: true, restoredOffers: restored, skippedOffers: skipped }
    }
  } catch (e) {
    if (isMissingTable(e)) return { ok: false, message: "L'historique des versions nécessite la migration 0020 (fichier prêt, à appliquer par le propriétaire)." }
    throw e
  }
  return { ok: false, message: "Version introuvable." }
}

export type { Category }
