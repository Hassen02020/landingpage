"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().optional(),
  body: z.string().optional(),
})

export type ReviewActionState = { error?: string; success?: boolean } | undefined

export async function createReviewAction(_prevState: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to write a review." }

  // status and is_verified_purchase are ignored here on purpose — the
  // guard_review_moderation_fields DB trigger computes/enforces both
  // authoritatively so a direct API call can't forge either one.
  const { error } = await supabase.from("reviews").insert({
    product_id: parsed.data.productId,
    customer_id: user.id,
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    body: parsed.data.body || null,
  })

  if (error) return { error: "Could not submit review." }

  revalidatePath("/product", "layout")
  return { success: true }
}
