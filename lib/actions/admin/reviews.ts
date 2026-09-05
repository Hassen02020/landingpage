"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function moderateReviewAction(reviewId: string, status: "approved" | "rejected") {
  const supabase = await createClient()
  const { error } = await supabase.from("reviews").update({ status }).eq("id", reviewId)
  if (error) return { success: false, error: "Could not update review." }

  if (status === "approved") {
    const { data: review } = await supabase.from("reviews").select("product_id").eq("id", reviewId).single()
    if (review) {
      const { data: approved } = await supabase
        .from("reviews")
        .select("rating")
        .eq("product_id", review.product_id)
        .eq("status", "approved")

      const ratings = approved ?? []
      const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0

      await supabase
        .from("products")
        .update({ avg_rating: Math.round(avg * 10) / 10, review_count: ratings.length })
        .eq("id", review.product_id)
    }
  }

  revalidatePath("/admin/reviews")
  return { success: true }
}
