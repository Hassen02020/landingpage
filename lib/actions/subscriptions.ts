"use server"

import { revalidatePath } from "next/cache"
import { getStripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"

async function getOwnedSubscription(subscriptionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id, customer_id")
    .eq("id", subscriptionId)
    .eq("customer_id", user.id)
    .maybeSingle()

  return data
}

export async function pauseSubscriptionAction(subscriptionId: string) {
  const subscription = await getOwnedSubscription(subscriptionId)
  if (!subscription) return { success: false, error: "Subscription not found." }

  const supabase = await createClient()
  try {
    if (subscription.stripe_subscription_id) {
      await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
        pause_collection: { behavior: "void" },
      })
    }
    await supabase.from("subscriptions").update({ status: "paused" }).eq("id", subscriptionId)
    revalidatePath("/account/subscriptions")
    return { success: true }
  } catch (err) {
    console.error("pauseSubscriptionAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not pause Autoship." }
  }
}

export async function resumeSubscriptionAction(subscriptionId: string) {
  const subscription = await getOwnedSubscription(subscriptionId)
  if (!subscription) return { success: false, error: "Subscription not found." }

  const supabase = await createClient()
  try {
    if (subscription.stripe_subscription_id) {
      await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
        pause_collection: "",
      })
    }
    await supabase.from("subscriptions").update({ status: "active" }).eq("id", subscriptionId)
    revalidatePath("/account/subscriptions")
    return { success: true }
  } catch (err) {
    console.error("resumeSubscriptionAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not resume Autoship." }
  }
}

export async function cancelSubscriptionAction(subscriptionId: string) {
  const subscription = await getOwnedSubscription(subscriptionId)
  if (!subscription) return { success: false, error: "Subscription not found." }

  const supabase = await createClient()
  try {
    if (subscription.stripe_subscription_id) {
      await getStripe().subscriptions.cancel(subscription.stripe_subscription_id)
    }
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscriptionId)
    revalidatePath("/account/subscriptions")
    return { success: true }
  } catch (err) {
    console.error("cancelSubscriptionAction:", err instanceof Error ? err.message : err)
    return { success: false, error: "Could not cancel Autoship." }
  }
}
