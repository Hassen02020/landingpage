import Link from "next/link"
import type { Metadata } from "next"
import { BLOG_POSTS } from "@/lib/blog-data"

export const metadata: Metadata = {
  title: "Blog",
  description: "Pet food and care guides from PETORA — buying guides, feeding schedules, and product picks.",
}

export default function BlogIndexPage() {
  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">PETORA Blog</h1>
      <p className="mt-2 text-sm text-ink-500">Buying guides and care tips for dog and cat owners.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="rounded-2xl border border-ink-100 bg-white p-6 hover:shadow-card"
          >
            <p className="text-xs text-ink-400">
              {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold text-ink">{post.title}</h2>
            <p className="mt-2 text-sm text-ink-600">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
