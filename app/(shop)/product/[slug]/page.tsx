import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ProductGallery } from "@/components/product/ProductGallery"
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel"
import { ProductInfo } from "@/components/product/ProductInfo"
import { ReviewsList } from "@/components/product/ReviewsList"
import { ProductGrid } from "@/components/product/ProductGrid"
import { getProductBySlug, getRelatedProducts, getApprovedReviews } from "@/lib/data/product"
import { createClient } from "@/lib/supabase/server"
import { ProductViewTracker } from "@/components/product/ProductViewTracker"
import { safeJsonLd } from "@/lib/utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return {}

  return {
    title: product.name,
    description: product.seoDescription ?? product.shortDescription ?? product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const supabase = await createClient()
  const [related, reviews, { data: { user } }] = await Promise.all([
    getRelatedProducts(product.categorySlug, product.id),
    getApprovedReviews(product.id),
    supabase.auth.getUser(),
  ])

  const lowestPrice = Math.min(...product.variants.map((v) => v.priceCents))
  const anyInStock = product.variants.some((v) => v.inStock)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    brand: product.brandName ? { "@type": "Brand", name: product.brandName } : undefined,
    image: product.images.map((i) => i.url),
    aggregateRating:
      product.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount }
        : undefined,
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
      author: { "@type": "Person", name: r.authorName ?? "PETORA Customer" },
      reviewBody: r.body ?? undefined,
    })),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (lowestPrice / 100).toFixed(2),
      availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: product.name },
    ],
  }

  return (
    <div className="container py-10 pb-28 lg:pb-10">
      <ProductViewTracker id={product.id} name={product.name} priceCents={lowestPrice} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />
        <ProductPurchasePanel product={product} />
      </div>

      <ProductInfo product={product} />
      <ReviewsList
        productId={product.id}
        reviews={reviews}
        rating={product.rating}
        count={product.reviewCount}
        isSignedIn={Boolean(user)}
      />

      {related.length > 0 && (
        <div className="mt-12 border-t border-ink-100 pt-8">
          <ProductGrid title="You May Also Like" products={related} bare titleAs="h2" />
        </div>
      )}
    </div>
  )
}
