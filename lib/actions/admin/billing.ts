"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export type ChangePlanState = { success: true } | { success: false; error: string }

/**
 * Free-tier downgrades apply immediately through change_tenant_plan()
 * (migration 0021) — no payment involved. A paid tier needs a real Stripe
 * Checkout session for the plan's price, which this environment doesn't
 * have configured (no stripe_price_id on any seeded plan, and
 * STRIPE_SECRET_KEY is blank) — that path fails with an honest error
 * rather than silently granting the plan, since the RPC itself also
 * refuses to apply a paid plan for a non-service-role caller.
 */
export async function changePlanAction(tenantId: string, planCode: string): Promise<ChangePlanState> {
  const supabase = await createClient()

  const { data: plan } = await supabase.from("billing_plans").select("code, price_cents, stripe_price_id").eq("code", planCode).single()
  if (!plan) return { success: false, error: "Unknown plan." }

  if (plan.price_cents > 0) {
    if (!plan.stripe_price_id) {
      return { success: false, error: "This plan has no Stripe price configured yet — billing checkout isn't set up in this environment." }
    }
    try {
      getStripe()
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Stripe is not configured." }
    }
    // A real deployment would create a Stripe Checkout session here and
    // redirect the tenant to pay; the subscription row itself is only
    // ever updated by the webhook once Stripe confirms payment (see
    // change_tenant_plan's service_role branch), never by this action.
    return { success: false, error: "Paid-plan checkout isn't wired up yet — this is where a Stripe Checkout redirect would go." }
  }

  const { error } = await supabase.rpc("change_tenant_plan", { target_tenant: tenantId, new_plan_code: planCode })
  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/billing")
  return { success: true }
}

export type BillingPortalState = { success: true; url: string } | { success: false; error: string }

/**
 * Launches Stripe's hosted Billing Portal for a tenant that already has a
 * stripe_customer_id (i.e. has been through paid checkout at least once).
 * No tenant in this environment has one yet — seeded on the free-adjacent
 * Growth plan with stripe_customer_id null — so this always reports that
 * honestly instead of fabricating a portal link.
 */
export async function createBillingPortalSessionAction(tenantId: string): Promise<BillingPortalState> {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from("tenant_billing_subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .single()

  if (!subscription?.stripe_customer_id) {
    return { success: false, error: "No Stripe customer on file yet — the billing portal is only available after a paid checkout." }
  }

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/billing`,
    })
    return { success: true, url: session.url }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not open the billing portal." }
  }
}
