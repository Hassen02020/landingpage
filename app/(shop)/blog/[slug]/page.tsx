import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { getBlogPost, BLOG_POSTS } from "@/lib/blog-data"
import { safeJsonLd } from "@/lib/utils"

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}
  return { title: post.title, description: post.excerpt }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "PETORA" },
    publisher: { "@type": "Organization", name: "PETORA" },
  }

  return (
    <article className="container max-w-2xl py-10">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <Link href="/blog" className="text-sm text-forest hover:underline">
        ← Back to Blog
      </Link>
      <p className="mt-4 text-xs text-ink-400">
        {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">{post.title}</h1>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-700">
        {post.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </article>
  )
}
