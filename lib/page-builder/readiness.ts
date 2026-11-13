// VÉRIFICATION DE COMPLÉTUDE avant publication (fonction PURE, appliquée côté SERVEUR à la publication et affichée à l'étape « Aperçu »).
// Deux niveaux : BLOQUANT (la page ne peut pas être publiée) et AVERTISSEMENT (publiable mais perfectible). Rien n'est inventé ni complété à la place de l'équipe.
import { familyOf, themeById, type Family, type OfferField } from "./themes"
import { isOfferExpired, isOfferValid, pageStatus } from "../page-status"

export interface CategoryLike {
  name: string
  slug: string
  product: string
  lang?: string
  headline: string | null
  description: string | null
  banner_desktop: string | null
  banner_mobile: string | null
  seo_title: string | null
  seo_description: string | null
  visible: boolean
}
export interface OfferRow {
  id?: string
  name: string
  price: number | string | null
  price_before?: number | string | null
  destination?: string | null
  departure_date?: string | null
  nights?: number | null
  seats_total?: number | null
  seats_sold?: number | null
  features?: string[] | null
  description?: string | null
  image_url?: string | null
  visible: boolean
  archived_at?: string | null
}
export interface Check { id: string; level: "bloquant" | "avertissement"; ok: boolean; label: string; detail?: string }
export interface Readiness { ready: boolean; blocking: number; warnings: number; checks: Check[] }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Exigences MINIMALES par famille, appliquées quoi que le navigateur envoie comme thème. */
const FAMILY_MIN: Record<Family, OfferField[]> = { omra: ["departure_date", "nights"], voyage: ["departure_date"], hotel: ["destination"], autre: [] }
const present = (o: OfferRow, f: OfferField): boolean => {
  const v = (o as unknown as Record<string, unknown>)[f]
  if (f === "features") return Array.isArray(v) && v.length > 0
  return v !== null && v !== undefined && String(v).trim() !== ""
}

export function readiness(category: CategoryLike, offers: OfferRow[], today: string, themeId?: string | null): Readiness {
  const family = familyOf(category.product)
  const theme = themeById(themeId)
  const required = Array.from(new Set<OfferField>([...FAMILY_MIN[family], ...(theme && familyOf(theme.product) === family ? theme.offerRequired : [])]))
  const checks: Check[] = []
  const add = (c: Check) => checks.push(c)
  const live = offers.filter((o) => o.visible && !o.archived_at)

  add({ id: "nom", level: "bloquant", ok: category.name.trim().length >= 2, label: "Nom de la page", detail: "Le nom est le titre principal de la page." })
  add({ id: "adresse", level: "bloquant", ok: SLUG.test(category.slug) && category.slug.length <= 60, label: "Adresse de la page", detail: "Minuscules, chiffres et tirets." })
  add({ id: "accroche", level: "bloquant", ok: Boolean(category.headline && category.headline.trim()), label: "Argument commercial (accroche)", detail: "Une phrase qui donne envie de réserver." })
  add({ id: "presentation", level: "bloquant", ok: Boolean(category.description && category.description.trim().length >= 20), label: "Présentation du produit", detail: "Au moins 20 caractères." })
  add({ id: "offre", level: "bloquant", ok: live.length > 0, label: "Au moins une offre affichée", detail: "Une page sans offre n'est pas prête à recevoir de la publicité." })
  const status = pageStatus({ visible: true, offers: live.map((o) => ({ ...o, visible: true })), today })
  add({ id: "offre-valide", level: "bloquant", ok: live.length === 0 || status.validOffers > 0, label: "Au moins une offre non expirée", detail: "Toutes les offres affichées ont une date de départ passée." })

  for (const o of live) {
    const missing: string[] = []
    if (!(o.name || "").trim()) missing.push("nom")
    if (o.price === null || o.price === undefined || String(o.price).trim() === "" || !(Number(o.price) >= 0)) missing.push("prix")
    for (const f of required) if (!present(o, f) && !missing.includes(f)) missing.push(f)
    if (required.includes("price_before") && o.price_before !== null && o.price_before !== undefined && Number(o.price_before) <= Number(o.price)) missing.push("prix barré supérieur au prix")
    const label = (o.name || "Offre sans nom").trim()
    add({ id: `offre:${o.id ?? label}`, level: "bloquant", ok: missing.length === 0, label: `Offre « ${label} » complète`, detail: missing.length ? `À renseigner : ${missing.join(", ")}.` : undefined })
  }

  add({ id: "banniere", level: "avertissement", ok: Boolean(category.banner_desktop || category.banner_mobile), label: "Bannière principale", detail: "Sans image, la page affiche un fond de couleur." })
  add({ id: "prestations", level: "avertissement", ok: live.some((o) => (o.features ?? []).length > 0), label: "Prestations incluses", detail: "Listez ce qui est réellement inclus." })
  if (family === "voyage" || family === "omra") add({ id: "programme", level: "avertissement", ok: live.some((o) => Boolean((o.description || "").trim())), label: "Programme ou détails", detail: "Le programme rassure les visiteurs." })
  add({ id: "photos", level: "avertissement", ok: live.length > 0 && live.every((o) => Boolean(o.image_url)), label: "Photo de chaque offre" })
  add({ id: "places", level: "avertissement", ok: live.some((o) => o.seats_total !== null && o.seats_total !== undefined), label: "Places disponibles renseignées", detail: "Facultatif : sans valeur, aucune rareté n'est affichée." })
  add({ id: "seo", level: "avertissement", ok: Boolean(category.seo_title && category.seo_description), label: "Titre et description pour les moteurs de recherche" })
  const expiredShown = live.filter((o) => isOfferExpired(o.departure_date, today)).length
  if (expiredShown > 0) add({ id: "expirees", level: "avertissement", ok: false, label: `${expiredShown} offre(s) expirée(s) encore affichée(s)`, detail: "Archivez-les ou changez leur date." })
  add({ id: "boutons", level: "avertissement", ok: true, label: "Boutons « Réserver » et « WhatsApp »", detail: "Toujours présents sur la page." })

  const blocking = checks.filter((c) => c.level === "bloquant" && !c.ok).length
  return { ready: blocking === 0, blocking, warnings: checks.filter((c) => c.level === "avertissement" && !c.ok).length, checks }
}

export { isOfferValid }
