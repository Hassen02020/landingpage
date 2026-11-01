// Données des départs Omra partagées entre la page serveur et la vue client.
export interface OmraPackage {
  id: string
  offerId?: string // identifiant catalogue (/admin/catalogue), absent pour les offres intégrées
  name: string
  date: string
  shortDate: string
  monthLabel: string
  price: number
  priceBefore?: number | null
  nights: number
  nightsDetail: string
  tag: string
  accent: string
  seatsLeft: number | null
}

// Offres intégrées : utilisées tant que le catalogue (/admin/catalogue) est vide ou indisponible
export const DEFAULT_PACKAGES: OmraPackage[] = [
  { id: "foj1", name: "الفوج الأول", date: "27 جانفي 2027", shortDate: "27 جانفي", monthLabel: "جانفي 2027", price: 5500, nights: 14, nightsDetail: "10 بمكة + 4 بالمدينة", tag: "✈️ أول فوج", accent: "emerald", seatsLeft: null },
  { id: "foj2", name: "الفوج الثاني", date: "18 فيفري 2027", shortDate: "18 فيفري", monthLabel: "فيفري 2027", price: 7800, nights: 25, nightsDetail: "20 بمكة + 5 بالمدينة", tag: "⭐ الإقامة الأطول", accent: "amber", seatsLeft: null },
  { id: "foj3", name: "عمرة شوال", date: "15 مارس 2027", shortDate: "15 مارس", monthLabel: "مارس 2027", price: 4800, nights: 14, nightsDetail: "10 بمكة + 4 بالمدينة", tag: "🕌 السعر الأقل", accent: "violet", seatsLeft: null },
]
