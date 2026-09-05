export type ProductCardData = {
  id: string
  slug: string
  name: string
  brandName: string | null
  imageUrl: string | null
  rating: number
  reviewCount: number
  priceCents: number
  compareAtPriceCents: number | null
  petType: "dog" | "cat" | "both"
  defaultVariantId: string | null
}

export type CategoryCardData = {
  id: string
  slug: string
  name: string
  imageUrl: string | null
}

export type BrandCardData = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

export type PromotionData = {
  id: string
  title: string
  subtitle: string | null
  ctaLabel: string | null
  ctaHref: string | null
  badgeText: string | null
}

export type ProductVariant = {
  id: string
  sku: string
  size: string | null
  flavor: string | null
  priceCents: number
  compareAtPriceCents: number | null
  inStock: boolean
}

export type ProductDetailData = {
  id: string
  slug: string
  name: string
  brandName: string | null
  brandSlug: string | null
  categorySlug: string | null
  shortDescription: string | null
  description: string | null
  ingredients: string | null
  feedingInstructions: string | null
  seoDescription: string | null
  petType: "dog" | "cat" | "both"
  lifeStage: string | null
  rating: number
  reviewCount: number
  isSubscribable: boolean
  images: { url: string; alt: string | null }[]
  variants: ProductVariant[]
}

export type ReviewData = {
  id: string
  rating: number
  title: string | null
  body: string | null
  isVerifiedPurchase: boolean
  createdAt: string
  authorName: string | null
}
