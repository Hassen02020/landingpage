import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { StarRating } from "@/components/ui/StarRating"
import { Badge } from "@/components/ui/Badge"
import { ReviewModerationActions } from "@/components/admin/ReviewModerationActions"

export const metadata: Metadata = { title: "Reviews" }

export default async function AdminReviewsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, status, is_verified_purchase, products(name)")
    .order("created_at", { ascending: false })
    .limit(200)

  const reviews = (data as any[]) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Reviews</h1>

      <div className="mt-6 space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-2xl border border-ink-100 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <Badge variant={review.status === "approved" ? "forest" : review.status === "rejected" ? "outline" : "sand"} className="capitalize">
                    {review.status}
                  </Badge>
                  {review.is_verified_purchase && <Badge variant="gold">Verified</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-400">{review.products?.name}</p>
                {review.title && <p className="mt-2 text-sm font-medium text-ink">{review.title}</p>}
                {review.body && <p className="mt-1 text-sm text-ink-600">{review.body}</p>}
              </div>
              {review.status === "pending" && <ReviewModerationActions reviewId={review.id} />}
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-ink-500">No reviews yet.</p>}
      </div>
    </div>
  )
}
