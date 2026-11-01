import type { Metadata } from "next"
import { dbConfigured } from "@/lib/server/db"
import { publicCategory, seatsLeft, type PublicOffer } from "@/lib/server/catalog"
import { arDate } from "@/lib/dates-ar"
import OmraView from "./OmraView"
import { DEFAULT_PACKAGES, type OmraPackage } from "./packages"

// Offres lues dans le catalogue (/admin/catalogue, catégorie « omra-2027 »), rafraîchies chaque minute.
// Catalogue vide ou indisponible : offres intégrées (la page ne casse jamais).
export const revalidate = 60
const CATEGORY_SLUG = "omra-2027"
const ACCENTS = ["emerald", "amber", "violet"]

function toPackage(o: PublicOffer, i: number): OmraPackage {
  const d = o.departure_date ? arDate(o.departure_date) : { full: "تاريخ يحدد لاحقاً", short: "قريباً", month: "" }
  return {
    id: o.sku || o.id,
    offerId: o.id,
    name: o.name,
    date: d.full,
    shortDate: d.short,
    monthLabel: d.month,
    price: Number(o.price),
    priceBefore: o.price_before !== null ? Number(o.price_before) : null,
    nights: o.nights ?? 0,
    nightsDetail: o.nights_detail ?? "",
    tag: o.tag ?? "",
    accent: ACCENTS[i % ACCENTS.length],
    seatsLeft: seatsLeft(o),
  }
}

async function loadPackages(): Promise<{ packages: OmraPackage[]; seo?: { title?: string | null; description?: string | null } }> {
  if (!dbConfigured()) return { packages: DEFAULT_PACKAGES }
  try {
    const data = await publicCategory(CATEGORY_SLUG)
    if (!data || data.offers.length === 0) return { packages: DEFAULT_PACKAGES }
    return { packages: data.offers.map(toPackage), seo: { title: data.category.seo_title, description: data.category.seo_description } }
  } catch {
    return { packages: DEFAULT_PACKAGES } // migration 0004 non appliquée ou base indisponible
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { packages, seo } = await loadPackages()
  const from = Math.min(...packages.map((p) => p.price))
  return {
    title: seo?.title || "عمرة رمضان وشوال 2027 — Easy2Book 🕋",
    description: seo?.description || `رحلة عمرة ابتداءً من ${from} د.ت — طيران + تأشيرة + فندق قريب من الحرم + مرافقة نسائية. أفواج: ${packages.map((p) => p.shortDate).join(" و")}.`,
  }
}

export default async function OmraPage() {
  const { packages } = await loadPackages()
  return <OmraView packages={packages} />
}
